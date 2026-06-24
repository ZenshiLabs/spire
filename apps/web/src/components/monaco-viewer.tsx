"use client";

import { DiffEditor, Editor, useMonaco } from "@monaco-editor/react";
import { shikiToMonaco } from "@shikijs/monaco";
import { useThemeStore } from "@spire/stores/theme-store";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

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

/** Subscribe a monaco instance to Shiki highlighting; resolves once ready. */
export function useShikiMonaco() {
  const monaco = useMonaco();
  const [ready, setReady] = useState(shikiRegistered);

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
    })();
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
    />
  );
}
