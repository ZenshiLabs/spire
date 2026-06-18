import {
    type BlobInput,
    dbEndSession,
    dbGetBlob,
    dbGetCheckpoint,
    dbGetCheckpoints,
    dbGetFileContent,
    dbGetFileHead,
    dbGetFilesHead,
    dbGetHeadContents,
    dbGetMaxCheckpointSeq,
    dbGetSession,
    dbGetSessionStats,
    dbGetSnapshot,
    dbSaveSnapshotTree,
    dbTouchSession,
    dbUpsertBlobs,
    dbUpsertSession,
    dbWriteCheckpoint,
    type HeadUpdate,
} from "@spire/db";
import {
    type ChangeType,
    type Checkpoint,
    type CheckpointChange,
    type CheckpointUpload,
    type CreateSessionInput,
    type FileNode,
    type FileSnapshot,
    type SessionResponse,
    type SSEEvent,
} from "@spire/types";
import { diffLines } from "diff";

type EndSessionResult =
    | { ok: true; session: SessionResponse }
    | { ok: false; code: "not_found" | "already_ended" };

type IngestResult =
    | { ok: true }
    | { ok: false; code: "not_found" | "inactive_session" };

/**
 * Sessions below these thresholds are served in "eager" mode: all current file
 * content is shipped in the initial `/state` payload so viewers open files
 * instantly. Larger sessions switch to "lazy" mode and fetch content per-file
 * on demand to keep the initial payload size and server memory usage bounded.
 */
const EAGER_MAX_BYTES = 1.5 * 1024 * 1024;
const EAGER_MAX_FILES = 400;

/**
 * Session state is persisted in Postgres via @spire/db. The pub/sub mechanism
 * here is intentionally in-process — it only fans live events to SSE clients
 * connected to this server instance, with no need for an external message broker
 * given the single-broadcaster-per-session design constraint.
 */
const sessionSubscribers = new Map<string, Set<(event: SSEEvent) => void>>();

function nowMs() {
    return Date.now();
}

function emitSessionEvent(sessionId: string, event: SSEEvent) {
    const listeners = sessionSubscribers.get(sessionId);
    if (!listeners || listeners.size === 0) {
        return;
    }
    for (const listener of listeners) {
        listener(event);
    }
}

type ExtractedFile = {
    path: string;
    hash: string;
    size: number;
    binary: boolean;
    content: string;
};

function extractFiles(node: FileNode, into: ExtractedFile[] = []): ExtractedFile[] {
    if (node.type === "file") {
        into.push({
            path: node.path,
            hash: node.hash,
            size: node.size,
            binary: Boolean(node.binary),
            content: node.binary ? "" : node.content ?? "",
        });
        return into;
    }
    for (const child of node.children) {
        extractFiles(child, into);
    }
    return into;
}

/**
 * Returns a deep copy of the tree node with all file `content` fields removed.
 * The metadata tree stored in Postgres and sent to viewers never carries inline
 * content — blobs are fetched separately by hash on demand.
 */
function stripContent(node: FileNode): FileNode {
    if (node.type === "file") {
        const copy = { ...node };
        delete copy.content;
        return copy;
    }
    return { ...node, children: node.children.map(stripContent) };
}

function countLines(text: string): number {
    return text.length === 0 ? 0 : text.split("\n").length;
}

function countDiff(before: string, after: string): { add: number; del: number } {
    let add = 0;
    let del = 0;
    for (const part of diffLines(before, after)) {
        if (part.added) {
            add += part.count ?? 0;
        } else if (part.removed) {
            del += part.count ?? 0;
        }
    }
    return { add, del };
}

function baseName(path: string): string {
    const parts = path.split("/");
    return parts[parts.length - 1] ?? path;
}

const VERB: Record<ChangeType, string> = {
    added: "Added",
    modified: "Updated",
    deleted: "Deleted",
    renamed: "Renamed",
};

function buildLabel(changes: CheckpointChange[]): string {
    const first = changes[0]!;
    const name = baseName(first.path);
    const verb = VERB[first.changeType];
    return changes.length === 1
        ? `${verb} ${name}`
        : `${verb} ${name} +${changes.length - 1} more`;
}

async function blobLineCount(sessionId: string, hash: string): Promise<number> {
    const blob = await dbGetBlob(sessionId, hash);
    return blob && !blob.binary ? countLines(blob.content) : 0;
}

/**
 * Creates a session if it does not exist, or reactivates an ended one.
 * Idempotent — re-running the CLI for the same ID yields a live session without
 * wiping history or resetting the share URL.
 */
export function upsertSession(
    sessionId: string,
    input: CreateSessionInput
): Promise<SessionResponse> {
    return dbUpsertSession(sessionId, input);
}

export function getSessionById(sessionId: string): Promise<SessionResponse | null> {
    return dbGetSession(sessionId);
}

export function getCheckpoints(sessionId: string, opts?: { limit?: number; beforeSeq?: number }) {
    return dbGetCheckpoints(sessionId, opts);
}

export function getCheckpoint(sessionId: string, seq: number) {
    return dbGetCheckpoint(sessionId, seq);
}

export function getFileContent(sessionId: string, path: string, ref: string) {
    return dbGetFileContent(sessionId, path, ref);
}

/**
 * Assembles the full initial payload for a connecting viewer: the session
 * record, the current metadata tree, recent checkpoint summaries, and the
 * load mode. In eager mode a hash → content map is also included so the
 * viewer can open files instantly without per-file fetches.
 */
export async function buildSessionState(sessionId: string) {
    const session = await dbGetSession(sessionId);
    if (!session) {
        return null;
    }

    const [snapshot, checkpoints, stats] = await Promise.all([
        dbGetSnapshot(sessionId),
        dbGetCheckpoints(sessionId, { limit: 200 }),
        dbGetSessionStats(sessionId),
    ]);

    const eager =
        stats.totalSize <= EAGER_MAX_BYTES && stats.fileCount <= EAGER_MAX_FILES;
    const contents = eager ? await dbGetHeadContents(sessionId) : undefined;

    return {
        session,
        snapshot,
        checkpoints,
        mode: eager ? ("eager" as const) : ("lazy" as const),
        contents,
    };
}

export function subscribeToSession(
    sessionId: string,
    listener: (event: SSEEvent) => void
) {
    const existing =
        sessionSubscribers.get(sessionId) ?? new Set<(event: SSEEvent) => void>();
    existing.add(listener);
    sessionSubscribers.set(sessionId, existing);

    return () => {
        const listeners = sessionSubscribers.get(sessionId);
        if (!listeners) {
            return;
        }
        listeners.delete(listener);
        if (listeners.size === 0) {
            sessionSubscribers.delete(sessionId);
        }
    };
}

export function buildConnectedEvent(sessionId: string): SSEEvent {
    return { type: "connected", sessionId, timestamp: nowMs() };
}

export async function endSession(sessionId: string): Promise<EndSessionResult> {
    const session = await dbGetSession(sessionId);
    if (!session) {
        return { ok: false, code: "not_found" };
    }
    if (session.status !== "active") {
        return { ok: false, code: "already_ended" };
    }

    const updated = await dbEndSession(sessionId);
    if (!updated) {
        return { ok: false, code: "not_found" };
    }

    emitSessionEvent(sessionId, {
        type: "session_ended",
        sessionId,
        timestamp: nowMs(),
    });

    return { ok: true, session: updated };
}

/**
 * Fans a checkpoint event to all SSE clients currently connected to this session.
 */
function emitCheckpoint(sessionId: string, checkpoint: Checkpoint) {
    emitSessionEvent(sessionId, { type: "checkpoint", payload: checkpoint });
}

/**
 * Ingests a full file tree from the CLI. Stores all file content as
 * content-addressed blobs and saves a metadata-only snapshot tree, then writes
 * a checkpoint capturing what changed relative to the prior head state.
 *
 * Checkpoint seq 0 is labelled "Initial snapshot" on a brand-new session.
 * Subsequent ingest calls (e.g. CLI reconnect) produce a "Resumed session"
 * checkpoint so history is never wiped even across server restarts.
 */
export async function ingestSnapshot(payload: FileSnapshot): Promise<IngestResult> {
    const session = await dbGetSession(payload.sessionId);
    if (!session) {
        return { ok: false, code: "not_found" };
    }
    if (session.status !== "active") {
        return { ok: false, code: "inactive_session" };
    }

    const sessionId = payload.sessionId;
    const now = new Date(payload.timestamp);
    const incoming = extractFiles(payload.tree);

    const [priorHead, maxSeq] = await Promise.all([
        dbGetFilesHead(sessionId),
        dbGetMaxCheckpointSeq(sessionId),
    ]);
    const priorByPath = new Map(priorHead.map((f) => [f.path, f]));
    const incomingPaths = new Set(incoming.map((f) => f.path));
    const isNew = maxSeq < 0;

    const blobByHash = new Map<string, BlobInput>();
    for (const f of incoming) {
        if (!blobByHash.has(f.hash)) {
            blobByHash.set(f.hash, {
                hash: f.hash,
                content: f.content,
                size: f.size,
                binary: f.binary,
            });
        }
    }
    await dbUpsertBlobs(sessionId, [...blobByHash.values()]);
    await dbSaveSnapshotTree(
        sessionId,
        stripContent(payload.tree),
        payload.sequenceNum,
        now
    );

    const changes: CheckpointChange[] = [];
    const headUpserts: HeadUpdate[] = [];
    const headDeletes: string[] = [];
    let additions = 0;
    let deletions = 0;

    for (const f of incoming) {
        const prior = priorByPath.get(f.path);
        if (!prior) {
            const add = f.binary ? 0 : countLines(f.content);
            additions += add;
            headUpserts.push({ path: f.path, hash: f.hash, size: f.size, binary: f.binary });
            changes.push({
                path: f.path,
                changeType: "added",
                beforeHash: null,
                afterHash: f.hash,
                additions: add,
                deletions: 0,
                binary: f.binary || undefined,
            });
        } else if (prior.hash !== f.hash) {
            let add = 0;
            let del = 0;
            if (!f.binary && !prior.binary) {
                const before = await dbGetBlob(sessionId, prior.hash);
                ({ add, del } = countDiff(before?.content ?? "", f.content));
            }
            additions += add;
            deletions += del;
            headUpserts.push({ path: f.path, hash: f.hash, size: f.size, binary: f.binary });
            changes.push({
                path: f.path,
                changeType: "modified",
                beforeHash: prior.hash,
                afterHash: f.hash,
                additions: add,
                deletions: del,
                binary: f.binary || undefined,
            });
        }
    }

    for (const prior of priorHead) {
        if (!incomingPaths.has(prior.path)) {
            const del = prior.binary ? 0 : await blobLineCount(sessionId, prior.hash);
            deletions += del;
            headDeletes.push(prior.path);
            changes.push({
                path: prior.path,
                changeType: "deleted",
                beforeHash: prior.hash,
                afterHash: null,
                additions: 0,
                deletions: del,
                binary: prior.binary || undefined,
            });
        }
    }

    if (changes.length > 0) {
        const seq = maxSeq + 1;
        const label = isNew ? "Initial snapshot" : "Resumed session";
        await dbWriteCheckpoint({
            sessionId,
            seq,
            label,
            createdAt: now,
            additions,
            deletions,
            filesChanged: changes.length,
            changes,
            headUpserts,
            headDeletes,
            newBlobs: [],
        });
        emitSessionEvent(sessionId, {
            type: "snapshot",
            payload: {
                sessionId,
                tree: stripContent(payload.tree),
                timestamp: payload.timestamp,
                sequenceNum: payload.sequenceNum,
            },
        });
        emitCheckpoint(sessionId, {
            sessionId,
            seq,
            label,
            createdAt: now.toISOString(),
            filesChanged: changes.length,
            additions,
            deletions,
            changes,
        });
    } else {
        emitSessionEvent(sessionId, {
            type: "snapshot",
            payload: {
                sessionId,
                tree: stripContent(payload.tree),
                timestamp: payload.timestamp,
                sequenceNum: payload.sequenceNum,
            },
        });
    }

    await dbTouchSession(sessionId);
    return { ok: true };
}

/**
 * Ingests a save-burst checkpoint: a batch of file changes uploaded by the CLI
 * after an idle or max-wait interval. The CLI sends only the new content and
 * hash per entry; the server resolves the prior version from the head-file
 * table, stores any new blobs, computes per-file diff stats, assigns the next
 * monotonic sequence number, and fans a lightweight checkpoint event to all
 * connected SSE viewers.
 */
export async function ingestCheckpoint(payload: CheckpointUpload): Promise<IngestResult> {
    const session = await dbGetSession(payload.sessionId);
    if (!session) {
        return { ok: false, code: "not_found" };
    }
    if (session.status !== "active") {
        return { ok: false, code: "inactive_session" };
    }

    const sessionId = payload.sessionId;
    const now = new Date(payload.timestamp);

    const changes: CheckpointChange[] = [];
    const headUpserts: HeadUpdate[] = [];
    const headDeletes: string[] = [];
    const newBlobs = new Map<string, BlobInput>();
    let additions = 0;
    let deletions = 0;

    for (const entry of payload.entries) {
        if (entry.changeType === "deleted") {
            const prior = await dbGetFileHead(sessionId, entry.path);
            const beforeHash = prior?.hash ?? null;
            const del =
                prior && !prior.binary && beforeHash
                    ? await blobLineCount(sessionId, beforeHash)
                    : 0;
            deletions += del;
            headDeletes.push(entry.path);
            changes.push({
                path: entry.path,
                changeType: "deleted",
                beforeHash,
                afterHash: null,
                additions: 0,
                deletions: del,
                binary: prior?.binary || undefined,
            });
            continue;
        }

        const afterHash = entry.hash;
        if (!afterHash) {
            continue;
        }

        const prior = await dbGetFileHead(sessionId, entry.path);
        const beforeHash = prior?.hash ?? null;
        if (prior && prior.hash === afterHash) {
            continue;
        }

        if (!newBlobs.has(afterHash)) {
            newBlobs.set(afterHash, {
                hash: afterHash,
                content: entry.binary ? "" : entry.content ?? "",
                size: entry.size,
                binary: Boolean(entry.binary),
            });
        }

        const changeType: ChangeType = prior ? "modified" : "added";
        let add = 0;
        let del = 0;
        if (!entry.binary) {
            const after = entry.content ?? "";
            if (!prior) {
                add = countLines(after);
            } else {
                const before = beforeHash ? await dbGetBlob(sessionId, beforeHash) : null;
                ({ add, del } = countDiff(before?.content ?? "", after));
            }
        }
        additions += add;
        deletions += del;
        headUpserts.push({
            path: entry.path,
            hash: afterHash,
            size: entry.size,
            binary: Boolean(entry.binary),
        });
        changes.push({
            path: entry.path,
            changeType,
            oldPath: entry.oldPath,
            beforeHash,
            afterHash,
            additions: add,
            deletions: del,
            binary: entry.binary || undefined,
        });
    }

    if (changes.length === 0) {
        return { ok: true };
    }

    const seq = (await dbGetMaxCheckpointSeq(sessionId)) + 1;
    const label = buildLabel(changes);
    await dbWriteCheckpoint({
        sessionId,
        seq,
        label,
        createdAt: now,
        additions,
        deletions,
        filesChanged: changes.length,
        changes,
        headUpserts,
        headDeletes,
        newBlobs: [...newBlobs.values()],
    });
    await dbTouchSession(sessionId);

    emitCheckpoint(sessionId, {
        sessionId,
        seq,
        label,
        createdAt: now.toISOString(),
        filesChanged: changes.length,
        additions,
        deletions,
        changes,
    });

    return { ok: true };
}
