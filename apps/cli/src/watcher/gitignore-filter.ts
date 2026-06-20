import { readFile } from "node:fs/promises";
import path from "node:path";

import ignore from "ignore";

import { toPosixPath } from "../config.js";

/**
 * Build-output directories that are always shown as empty stubs in the file
 * tree regardless of .gitignore contents. The folder node appears so viewers
 * know the directory exists, but its contents are never watched, hashed, or
 * included in snapshots. This list is applied in addition to .gitignore rules,
 * not instead of them.
 */
export const STUB_DIRS = ["dist", ".next", "build", "out", "coverage", ".build"];

/** Set view of STUB_DIRS for O(1) membership checks in the hot watcher path. */
const STUB_DIR_SET = new Set(STUB_DIRS);

const DEFAULT_IGNORES = [
    "node_modules/**",
    ".git/**",
    ".env",
    ".env.*",
    ...STUB_DIRS.map((dir) => `${dir}/**`),
];

/**
 * Returns true when the directory at `absolutePath` should be rendered as a
 * contents-hidden stub node. Stub dirs are excluded from the watcher, hashing,
 * and snapshot traversal irrespective of any .gitignore rules.
 */
export function isStubDir(absolutePath: string): boolean {
    return STUB_DIR_SET.has(path.basename(absolutePath));
}

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
        /**
         * .gitignore is optional — projects without one still get the default
         * ignore list (node_modules, .git, .env, build outputs).
         */
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
