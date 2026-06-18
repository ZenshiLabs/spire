"use client";

import { DiffEditor, Editor, useMonaco } from "@monaco-editor/react";
import { shikiToMonaco } from "@shikijs/monaco";
import { useThemeStore } from "@spire/stores/theme-store";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getHighlighter, resolveEditorTheme } from "@/lib/shiki";

const EXTENSION_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  html: "html",
  htm: "html",
  xml: "xml",
  svg: "xml",
  md: "markdown",
  markdown: "markdown",
  mdx: "markdown",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  swift: "swift",
  dart: "dart",
  sh: "shellscript",
  bash: "shellscript",
  zsh: "shellscript",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  dockerfile: "docker",
  lua: "lua",
  r: "r",
  pl: "perl",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
};

export function languageForPath(path: string): string {
  const name = path.split("/").pop() ?? path;
  if (name.toLowerCase() === "dockerfile") {
    return "docker";
  }
  const extension = name.includes(".") ? name.split(".").pop()! : "";
  return EXTENSION_LANGUAGE[extension.toLowerCase()] ?? "plaintext";
}

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
}: {
  path: string;
  original: string;
  modified: string;
  sideBySide?: boolean;
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
      }}
    />
  );
}
