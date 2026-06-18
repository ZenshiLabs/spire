import { createHighlighter, bundledThemesInfo, bundledLanguagesInfo, type Highlighter } from "shiki";

export type ThemeKind = "light" | "dark";
export type ThemeOption = { id: string; label: string; kind: ThemeKind };

export const EDITOR_THEMES: ThemeOption[] = bundledThemesInfo.map((t) => ({
    id: t.id,
    label: t.displayName,
    kind: t.type,
}));

export const DEFAULT_LIGHT_THEME = "github-light";
export const DEFAULT_DARK_THEME = "github-dark";

const SHIKI_LANGS = bundledLanguagesInfo.map((l) => l.id);

let highlighterPromise: Promise<Highlighter> | null = null;

/** Lazily create the shared highlighter once and reuse it across editors. */
export function getHighlighter(): Promise<Highlighter> {
    if (!highlighterPromise) {
        highlighterPromise = createHighlighter({
            themes: EDITOR_THEMES.map((theme) => theme.id),
            langs: SHIKI_LANGS,
        });
    }
    return highlighterPromise;
}

/** Resolve the active Shiki theme id, expanding "auto" via the app's mode. */
export function resolveEditorTheme(
    editorTheme: string,
    resolvedMode: string | undefined
): string {
    if (editorTheme !== "auto") {
        return editorTheme;
    }
    return resolvedMode === "dark" ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
}
