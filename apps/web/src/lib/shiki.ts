import { createHighlighter, type Highlighter } from "shiki";

export type ThemeKind = "light" | "dark";
export type ThemeOption = { id: string; label: string; kind: ThemeKind };

/** Curated Shiki themes offered in the picker (all exist in shiki's bundle). */
export const EDITOR_THEMES: ThemeOption[] = [
    { id: "github-light", label: "GitHub Light", kind: "light" },
    { id: "vitesse-light", label: "Vitesse Light", kind: "light" },
    { id: "catppuccin-latte", label: "Catppuccin Latte", kind: "light" },
    { id: "min-light", label: "Min Light", kind: "light" },
    { id: "github-dark", label: "GitHub Dark", kind: "dark" },
    { id: "vitesse-dark", label: "Vitesse Dark", kind: "dark" },
    { id: "one-dark-pro", label: "One Dark Pro", kind: "dark" },
    { id: "dracula", label: "Dracula", kind: "dark" },
    { id: "nord", label: "Nord", kind: "dark" },
    { id: "catppuccin-mocha", label: "Catppuccin Mocha", kind: "dark" },
    { id: "min-dark", label: "Min Dark", kind: "dark" },
];

export const DEFAULT_LIGHT_THEME = "github-light";
export const DEFAULT_DARK_THEME = "github-dark";

/** Shiki grammars preloaded into the highlighter (cover common shared code). */
const SHIKI_LANGS = [
    "typescript", "javascript", "tsx", "jsx", "json", "jsonc", "css", "scss",
    "less", "html", "xml", "markdown", "mdx", "python", "ruby", "go", "rust",
    "java", "kotlin", "c", "cpp", "csharp", "php", "swift", "dart", "shellscript",
    "yaml", "toml", "sql", "graphql", "docker", "lua", "r", "perl", "vue",
    "svelte", "astro",
];

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
