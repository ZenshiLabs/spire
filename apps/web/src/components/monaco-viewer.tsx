"use client";

import { DiffEditor, Editor, useMonaco } from "@monaco-editor/react";
import { shikiToMonaco } from "@shikijs/monaco";
import { useThemeStore } from "@spire/stores/theme-store";
import type * as Monaco from "monaco-editor";
import { useTheme } from "next-themes";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { languageForPath } from "@/lib/languages";
import { getHighlighter, resolveEditorTheme } from "@/lib/shiki";

export { languageForPath };

export const MONACO_OPTIONS = {
  readOnly: true,
  domReadOnly: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  fontSize: 13,
  fontFamily: "var(--font-geist-mono), monospace",
  smoothScrolling: true,
  renderWhitespace: "selection",
  scrollbar: { alwaysConsumeMouseWheel: false },
  padding: { top: 12, bottom: 12 },
} as const;

/**
 * Guards a one-time Shiki registration into the global Monaco instance. Shiki
 * languages and themes only need to be registered once per page load; repeated
 * calls to `shikiToMonaco` would add duplicate listeners.
 */
let shikiRegistered = false;

function isMonacoCancelation(reason: unknown): boolean {
  return (
    reason !== null &&
    typeof reason === "object" &&
    (reason as Record<string, unknown>).type === "cancelation"
  );
}

/** Subscribe a monaco instance to Shiki highlighting; resolves once ready. */
export function useShikiMonaco() {
  const monaco = useMonaco();
  const [ready, setReady] = useState(shikiRegistered);

  // Monaco's language-service workers reject with a plain {type:'cancelation'}
  // object (not an Error) when operations are preempted. React 19 intercepts
  // unhandledrejection in the bubble phase; we use capture to run first and
  // stop propagation so the dev overlay never sees these rejections.
  useEffect(() => {
    const suppress = (event: PromiseRejectionEvent) => {
      if (isMonacoCancelation(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("unhandledrejection", suppress, { capture: true });
    return () => window.removeEventListener("unhandledrejection", suppress, { capture: true });
  }, []);

  useEffect(() => {
    if (!monaco) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const highlighter = await getHighlighter();
      if (cancelled) {
        return;
      }
      if (!shikiRegistered) {
        for (const lang of highlighter.getLoadedLanguages()) {
          monaco.languages.register({ id: lang });
        }
        shikiToMonaco(highlighter, monaco);
        shikiRegistered = true;
      }
      setReady(true);
    })().catch((err: unknown) => {
      if (!isMonacoCancelation(err)) throw err;
    });
    return () => {
      cancelled = true;
    };
  }, [monaco]);

  return { monaco, ready };
}

/** Current Shiki theme id, plus a built-in fallback used until Shiki is ready. */
export function useEditorTheme() {
  const editorTheme = useThemeStore((state) => state.editorTheme);
  const { resolvedTheme } = useTheme();
  const shikiTheme = resolveEditorTheme(editorTheme, resolvedTheme);
  const fallback = resolvedTheme === "dark" ? "vs-dark" : "light";
  return { shikiTheme, fallback };
}

export function MonacoViewer({
  path,
  value,
  wordWrap = "off",
}: {
  path: string;
  value: string;
  wordWrap?: "on" | "off";
}) {
  const { monaco, ready } = useShikiMonaco();
  const { shikiTheme, fallback } = useEditorTheme();
  const theme = ready ? shikiTheme : fallback;

  useEffect(() => {
    if (monaco && ready) {
      monaco.editor.setTheme(shikiTheme);
    }
  }, [monaco, ready, shikiTheme]);

  return (
    <Editor
      height="100%"
      path={path}
      language={languageForPath(path)}
      value={value}
      theme={theme}
      loading={<Skeleton className="size-full rounded-none" />}
      options={{ ...MONACO_OPTIONS, wordWrap }}
    />
  );
}

export function MonacoDiffViewer({
  path,
  original,
  modified,
  sideBySide = true,
  wordWrap = "off",
}: {
  path: string;
  original: string;
  modified: string;
  sideBySide?: boolean;
  wordWrap?: "on" | "off";
}) {
  const { monaco, ready } = useShikiMonaco();
  const { shikiTheme, fallback } = useEditorTheme();
  const theme = ready ? shikiTheme : fallback;
  const editorRef = useRef<Monaco.editor.IStandaloneDiffEditor | null>(null);

  // Monaco 0.55 throws "TextModel got disposed before DiffEditorWidget model
  // got reset" when @monaco-editor/react's passive-effect cleanup disposes
  // models while the DiffEditorWidget still holds references. Layout-effect
  // cleanups run before passive-effect cleanups, so we can null out the model
  // while the editor is still in a valid state.
  useLayoutEffect(() => {
    return () => {
      editorRef.current?.setModel(null);
    };
  }, []);

  useEffect(() => {
    if (monaco && ready) {
      monaco.editor.setTheme(shikiTheme);
    }
  }, [monaco, ready, shikiTheme]);

  return (
    <DiffEditor
      height="100%"
      language={languageForPath(path)}
      original={original}
      modified={modified}
      theme={theme}
      loading={<Skeleton className="size-full rounded-none" />}
      options={{
        ...MONACO_OPTIONS,
        renderSideBySide: sideBySide,
        originalEditable: false,
        wordWrap,
      }}
      onMount={(editor) => {
        editorRef.current = editor;
      }}
    />
  );
}
