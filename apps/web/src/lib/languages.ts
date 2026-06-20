import { bundledLanguagesInfo } from "shiki";

/**
 * Extension/alias -> Shiki language id, derived from Shiki's own bundled
 * metadata so it stays in sync with whatever grammars ship. Every language id
 * and alias (e.g. `ts`, `yml`, `dockerfile`) resolves to its canonical id.
 */
const EXTENSION_LANGUAGE = new Map<string, string>();
for (const lang of bundledLanguagesInfo) {
    EXTENSION_LANGUAGE.set(lang.id, lang.id);
    for (const alias of lang.aliases ?? []) {
        EXTENSION_LANGUAGE.set(alias, lang.id);
    }
}

/**
 * File-extension synonyms Shiki doesn't register as language aliases. Keep this
 * minimal — anything Shiki already knows about is picked up automatically above.
 */
const EXTRA_EXTENSIONS: Record<string, string> = {
    htm: "html",
    svg: "xml",
    h: "c",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    pl: "perl",
};
for (const [ext, id] of Object.entries(EXTRA_EXTENSIONS)) {
    EXTENSION_LANGUAGE.set(ext, id);
}

/** Resolve a file path to a Shiki/Monaco language id, or `plaintext`. */
export function languageForPath(path: string): string {
    const name = path.split("/").pop() ?? path;
    if (name.toLowerCase() === "dockerfile") {
        return "docker";
    }
    const extension = name.includes(".") ? name.split(".").pop()! : "";
    return EXTENSION_LANGUAGE.get(extension.toLowerCase()) ?? "plaintext";
}
