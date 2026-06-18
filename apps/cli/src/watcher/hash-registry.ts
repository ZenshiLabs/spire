import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { FileNode } from "@spire/types";

/**
 * In-memory map of absolute file path → SHA-256 hex hash. Used by the watcher
 * to detect whether a file's content actually changed before building a
 * checkpoint entry — OS-level write events fire for metadata touches, saves
 * that produce identical output, and other non-content changes.
 */
export class HashRegistry {
    private readonly hashes = new Map<string, string>();

    get(filePath: string): string | undefined {
        return this.hashes.get(filePath);
    }

    set(filePath: string, hash: string) {
        this.hashes.set(filePath, hash);
    }

    remove(filePath: string) {
        this.hashes.delete(filePath);
    }

    hasChanged(filePath: string, nextHash: string): boolean {
        return this.hashes.get(filePath) !== nextHash;
    }

    static fromContent(content: string): string {
        return createHash("sha256").update(content).digest("hex");
    }

    static fromBuffer(buffer: Buffer): string {
        return createHash("sha256").update(buffer).digest("hex");
    }

    static async fromFile(filePath: string): Promise<string> {
        const content = await readFile(filePath);
        return createHash("sha256").update(content).digest("hex");
    }
}

/**
 * Seeds a HashRegistry from a freshly-built snapshot tree. Because the snapshot
 * builder already hashed every file during its traversal, reusing those hashes
 * here avoids a redundant second directory walk immediately after the first.
 */
export function hashRegistryFromSnapshot(
    rootDir: string,
    tree: FileNode
): HashRegistry {
    const registry = new HashRegistry();
    const walk = (node: FileNode) => {
        if (node.type === "file") {
            registry.set(path.join(rootDir, node.path), node.hash);
            return;
        }
        for (const child of node.children) {
            walk(child);
        }
    };
    walk(tree);
    return registry;
}
