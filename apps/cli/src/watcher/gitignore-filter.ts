import { readFile } from "node:fs/promises";
import path from "node:path";

import ignore from "ignore";

import { toPosixPath } from "../config.js";

const DEFAULT_IGNORES = [
    "node_modules/**",
    ".next/**",
    "dist/**",
    "coverage/**",
    ".git/**",
    ".env",
    ".env.*",
];

export type PathFilter = {
    accepts: (absolutePath: string) => boolean;
    toRelativePath: (absolutePath: string) => string;
};

export async function createPathFilter(rootDir: string): Promise<PathFilter> {
    const ig = ignore();
    ig.add(DEFAULT_IGNORES);

    try {
        const gitignore = await readFile(path.join(rootDir, ".gitignore"), "utf8");
        ig.add(gitignore);
    } catch {
        // .gitignore file is optional.
    }

    function toRelativePath(absolutePath: string): string {
        return toPosixPath(path.relative(rootDir, absolutePath));
    }

    return {
        accepts(absolutePath: string) {
            const relativePath = toRelativePath(absolutePath);

            if (!relativePath || relativePath.startsWith("..")) {
                return false;
            }

            return !ig.ignores(relativePath);
        },
        toRelativePath,
    };
}
