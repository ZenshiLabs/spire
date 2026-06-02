import { type FileNode, type FileSnapshot } from "@spire/types";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { toPosixPath } from "../config.js";

function hashContent(content: Buffer) {
    return createHash("sha256").update(content).digest("hex");
}

async function buildNode(
    rootDir: string,
    absolutePath: string,
    accepts: (absolutePath: string) => boolean
): Promise<FileNode | null> {
    if (!accepts(absolutePath)) {
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

                const content = await readFile(entryPath);
                const relativePath = toPosixPath(path.relative(rootDir, entryPath));

                return {
                    type: "file",
                    name: entry.name,
                    path: relativePath,
                    size: content.byteLength,
                    hash: hashContent(content),
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
