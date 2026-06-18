import { type FileNode, type FileSnapshot } from "@spire/types";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { MAX_FILE_BYTES, toPosixPath } from "../config.js";
import { isBinaryContent } from "../watcher/binary.js";
import { isStubDir } from "../watcher/gitignore-filter.js";

function hashContent(content: string) {
    return createHash("sha256").update(content).digest("hex");
}

function hashBuffer(buffer: Buffer) {
    return createHash("sha256").update(buffer).digest("hex");
}

async function buildNode(
    rootDir: string,
    absolutePath: string,
    accepts: (absolutePath: string) => boolean
): Promise<FileNode | null> {
    /**
     * The root directory itself has an empty relative path, which the path filter
     * would reject. Guard it explicitly so its children can be filtered normally.
     */
    const isRoot = path.resolve(absolutePath) === path.resolve(rootDir);

    /**
     * Build-output directories (dist, .next, etc.) are rendered as an empty stub
     * node — the folder name appears in the tree but its contents are hidden. This
     * takes precedence over the accept check so the stub shows even when the
     * directory is also listed in .gitignore and would otherwise be dropped entirely.
     */
    if (!isRoot && isStubDir(absolutePath)) {
        return {
            type: "directory",
            name: path.basename(absolutePath),
            path: toPosixPath(path.relative(rootDir, absolutePath)),
            children: [],
            ignored: true,
        } satisfies FileNode;
    }

    if (!isRoot && !accepts(absolutePath)) {
        return null;
    }

    const entries = await readdir(absolutePath, { withFileTypes: true }).catch(() => []);

    const children = (
        await Promise.all(
            entries.map(async (entry) => {
                const entryPath = path.join(absolutePath, entry.name);

                if (entry.isDirectory()) {
                    return buildNode(rootDir, entryPath, accepts);
                }

                if (!entry.isFile() || !accepts(entryPath)) {
                    return null;
                }

                const relativePath = toPosixPath(path.relative(rootDir, entryPath));
                const stats = await stat(entryPath).catch(() => null);
                if (!stats) {
                    return null;
                }

                /**
                 * Files exceeding the size limit are listed in the tree but never read.
                 * Embedding their bytes would risk an out-of-memory condition and bloat
                 * the snapshot payload. They are shown as a non-renderable stub, the same
                 * treatment applied to binary files.
                 */
                if (stats.size > MAX_FILE_BYTES) {
                    return {
                        type: "file",
                        name: entry.name,
                        path: relativePath,
                        size: stats.size,
                        hash: hashContent(`oversize:${stats.size}:${relativePath}`),
                        content: "",
                        binary: true,
                    } satisfies FileNode;
                }

                const buffer = await readFile(entryPath);

                /**
                 * Binary files (images, fonts, archives, etc.) are listed in the tree
                 * but their raw bytes are never embedded in the payload. Postgres rejects
                 * NUL bytes in text/JSON columns (error 22P05), so reading a binary file
                 * as UTF-8 would produce a large payload that fails the upload. The raw
                 * bytes are still hashed so a subsequent change remains detectable.
                 */
                if (isBinaryContent(buffer)) {
                    return {
                        type: "file",
                        name: entry.name,
                        path: relativePath,
                        size: buffer.byteLength,
                        hash: hashBuffer(buffer),
                        content: "",
                        binary: true,
                    } satisfies FileNode;
                }

                const content = buffer.toString("utf8");

                return {
                    type: "file",
                    name: entry.name,
                    path: relativePath,
                    size: buffer.byteLength,
                    hash: hashContent(content),
                    content,
                } satisfies FileNode;
            })
        )
    ).filter((node): node is FileNode => node !== null);

    const directoryPath = toPosixPath(path.relative(rootDir, absolutePath)) || ".";

    return {
        type: "directory",
        name: path.basename(absolutePath) || ".",
        path: directoryPath,
        children,
    };
}

export async function buildFileSnapshot(
    sessionId: string,
    rootDir: string,
    accepts: (absolutePath: string) => boolean
): Promise<FileSnapshot> {
    const tree = await buildNode(rootDir, rootDir, accepts);

    return {
        sessionId,
        tree:
            tree ?? {
                type: "directory",
                name: path.basename(rootDir) || ".",
                path: ".",
                children: [],
            },
        timestamp: Date.now(),
        sequenceNum: 0,
    };
}
