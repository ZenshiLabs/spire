import type {
    CheckpointUpload,
    FileNode,
    FileSnapshot,
    SessionManifest,
} from "@spire/types";

function collectFiles(node: FileNode, into: Map<string, FileNode>): void {
    if (node.type === "file") {
        into.set(node.path, node);
        return;
    }
    for (const child of node.children) {
        collectFiles(child, into);
    }
}

/**
 * Diffs a freshly-built local snapshot against the server's head-file manifest
 * and produces a checkpoint containing only what differs — new files, modified
 * files, and deletions for server files no longer present locally. Returns null
 * when local and server state already match, letting the caller skip the upload
 * entirely on rejoin instead of re-sending the whole snapshot.
 *
 * Content is read from the snapshot tree, which already inlines it (empty for
 * binary/oversize stubs), so no second filesystem walk is needed.
 */
export function buildRejoinCheckpoint(
    sessionId: string,
    manifest: SessionManifest,
    snapshot: FileSnapshot
): CheckpointUpload | null {
    const local = new Map<string, FileNode>();
    collectFiles(snapshot.tree, local);

    const serverHashes = new Map(manifest.files.map((file) => [file.path, file.hash]));
    const entries: CheckpointUpload["entries"] = [];

    for (const [path, node] of local) {
        if (node.type !== "file") continue;
        const serverHash = serverHashes.get(path);
        if (serverHash === node.hash) {
            continue;
        }
        entries.push({
            path,
            changeType: serverHash === undefined ? "added" : "modified",
            hash: node.hash,
            size: node.size,
            ...(node.binary ? { binary: true } : { content: node.content ?? "" }),
        });
    }

    for (const file of manifest.files) {
        if (!local.has(file.path)) {
            entries.push({
                path: file.path,
                changeType: "deleted",
                hash: null,
                size: 0,
            });
        }
    }

    if (entries.length === 0) {
        return null;
    }
    return { sessionId, entries, timestamp: Date.now() };
}
