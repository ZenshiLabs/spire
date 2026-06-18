import type { FileNode } from "@spire/types";

/**
 * Recursively collects the virtual paths of all binary files in the tree.
 * Used to skip content fetches and render placeholders for binary entries.
 */
export function collectBinaryPaths(
    node: FileNode,
    into: Set<string> = new Set()
): Set<string> {
    if (node.type === "file") {
        if (node.binary) {
            into.add(node.path);
        }
        return into;
    }
    for (const child of node.children) {
        collectBinaryPaths(child, into);
    }
    return into;
}

/**
 * Returns every file path in the tree in an unordered flat array.
 */
export function listFilePaths(node: FileNode, into: string[] = []): string[] {
    if (node.type === "file") {
        into.push(node.path);
        return into;
    }
    for (const child of node.children) {
        listFilePaths(child, into);
    }
    return into;
}

/**
 * Returns the lexicographically first file path in the tree, used to auto-open
 * a sensible default file when a viewer first loads a session.
 */
export function firstFilePath(node: FileNode): string | undefined {
    return listFilePaths(node).sort()[0];
}
