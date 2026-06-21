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
    baseName,
    HASH_RE,
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

import {
    cacheDel,
    cacheGetJSON,
    cacheSetJSON,
    ensureSubscriber,
    nextCheckpointSeq,
    publishSessionEvent as redisPublishEvent,
} from "@/lib/redis";

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
 *
 * Override via SPIRE_EAGER_MAX_BYTES / SPIRE_EAGER_MAX_FILES env vars without
 * redeploying, e.g. to tune thresholds in staging.
 */
const EAGER_MAX_BYTES =
    Number(process.env.SPIRE_EAGER_MAX_BYTES) || 1.5 * 1024 * 1024;
const EAGER_MAX_FILES =
    Number(process.env.SPIRE_EAGER_MAX_FILES) || 400;

/**
 * Session rows change rarely and are read on every SSE connect. Cache them for a
 * short window and invalidate explicitly on every status transition (create,
 * reactivate, end) so an ended session is never served as active. Blobs are
 * immutable and content-addressed, so they cache for far longer with no
 * invalidation. Both are no-ops when Redis is disabled.
 */
const SESSION_CACHE_TTL = 30;
const BLOB_CACHE_TTL = 60 * 60 * 24;

/**
 * A broadcast is "live" only while the CLI keeps heartbeating. If no heartbeat
 * (or checkpoint) has touched the session within this window, viewers see it as
 * ended even though the row is still `active` — this is what surfaces an abrupt
 * CLI exit (closed terminal, kill, crash, lost network) where the explicit
 * end-session call never reached the server. Kept comfortably above both
 * SESSION_CACHE_TTL and the CLI heartbeat interval so a cached row or a single
 * dropped heartbeat can never make a genuinely live session look ended.
 */
const SESSION_STALE_MS = Number(process.env.SPIRE_SESSION_STALE_MS) || 45_000;

const sessionKey = (sessionId: string) => `sess:${sessionId}`;
const blobKey = (sessionId: string, hash: string) => `blob:${sessionId}:${hash}`;

type CachedBlob = { content: string; binary: boolean };

/**
 * Live events are fanned out to SSE clients connected to *this* process via the
 * in-memory `sessionSubscribers` map. When `REDIS_URL` is set, events are also
 * published to a shared Redis channel and replayed into the same local fan-out
 * on every *other* instance — so a checkpoint POST on one node reaches viewers
 * whose SSE stream is held open on another. With Redis off this stays a pure
 * in-process broker, exactly as before.
 */
const sessionSubscribers = new Map<string, Set<(event: SSEEvent) => void>>();

function nowMs() {
    return Date.now();
}

/** True when an active session's last heartbeat has aged past the live window. */
function isStale(session: SessionResponse): boolean {
    return (
        session.status === "active" &&
        nowMs() - new Date(session.updatedAt).getTime() > SESSION_STALE_MS
    );
}

/**
 * Presents a session's liveness to viewers. A row that is still `active` in the
 * database but whose heartbeat has gone stale is reported as ended (with
 * `endedAt` pinned to when it was last seen) without mutating the row — so a CLI
 * that recovers from a brief network drop resumes as live on its next heartbeat.
 * The persisted status only ever changes on an explicit start/stop.
 */
function withLiveness(session: SessionResponse): SessionResponse {
    if (!isStale(session)) {
        return session;
    }
    return { ...session, status: "ended", endedAt: session.updatedAt };
}

/** Delivers an event only to SSE clients connected to this process. */
function emitSessionEvent(sessionId: string, event: SSEEvent) {
    const listeners = sessionSubscribers.get(sessionId);
    if (!listeners || listeners.size === 0) {
        return;
    }
    for (const listener of listeners) {
        listener(event);
    }
}

/**
 * Delivers locally now (low latency, unchanged behaviour) and publishes to other
 * instances. The publishing instance skips its own echo on the subscriber side,
 * so each viewer receives the event exactly once.
 */
function broadcastSessionEvent(sessionId: string, event: SSEEvent) {
    emitSessionEvent(sessionId, event);
    redisPublishEvent(sessionId, event);
}

/** Reads a blob through the shared cache, writing through on a miss. */
async function readBlobCached(
    sessionId: string,
    hash: string
): Promise<CachedBlob | null> {
    const key = blobKey(sessionId, hash);
    const cached = await cacheGetJSON<CachedBlob>(key);
    if (cached) {
        return cached;
    }
    const blob = await dbGetBlob(sessionId, hash);
    if (!blob) {
        return null;
    }
    const value: CachedBlob = { content: blob.content, binary: blob.binary };
    await cacheSetJSON(key, value, BLOB_CACHE_TTL);
    return value;
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

/**
 * Creates a session if it does not exist, or reactivates an ended one.
 * Idempotent — re-running the CLI for the same ID yields a live session without
 * wiping history or resetting the share URL.
 */
export async function upsertSession(
    sessionId: string,
    input: CreateSessionInput
): Promise<SessionResponse> {
    const session = await dbUpsertSession(sessionId, input);
    // Status flipped to active (and title/desc may have changed) — drop any
    // cached row so reads see the live record immediately.
    await cacheDel(sessionKey(sessionId));
    return session;
}

export async function getSessionById(
    sessionId: string
): Promise<SessionResponse | null> {
    const key = sessionKey(sessionId);
    // The raw row is cached; liveness is derived per read against the current
    // clock so a session that goes stale while cached is still reported ended.
    const cached = await cacheGetJSON<SessionResponse>(key);
    if (cached) {
        return withLiveness(cached);
    }
    const session = await dbGetSession(sessionId);
    if (session) {
        await cacheSetJSON(key, session, SESSION_CACHE_TTL);
    }
    return session ? withLiveness(session) : null;
}

/**
 * Records CLI liveness by bumping `updatedAt`, keeping the session inside the
 * live window even when an idle broadcast is sending no checkpoints. Returns
 * false if the session does not exist. Never changes status — see withLiveness.
 */
export async function touchSession(sessionId: string): Promise<boolean> {
    const session = await dbGetSession(sessionId);
    if (!session) {
        return false;
    }
    await dbTouchSession(sessionId);
    return true;
}

/**
 * Whether an open viewer stream should close because the broadcast has gone
 * stale (the CLI stopped heartbeating). Reads the row directly — bypassing the
 * cache — so it reflects the latest heartbeat. Presentational only: it does not
 * mutate the session, so a recovering CLI can still resume as live.
 */
export async function isSessionStale(sessionId: string): Promise<boolean> {
    const session = await dbGetSession(sessionId);
    return session ? isStale(session) : true;
}

export function getCheckpoints(sessionId: string, opts?: { limit?: number; beforeSeq?: number }) {
    return dbGetCheckpoints(sessionId, opts);
}

export function getCheckpoint(sessionId: string, seq: number) {
    return dbGetCheckpoint(sessionId, seq);
}

/**
 * Resolves file content for a `ref`, caching the immutable blob by hash. A
 * direct hash ref is served straight from cache on a hit; "latest"/seq refs
 * resolve through the DB (the head can move) but still warm the blob cache by
 * the resolved hash for subsequent opens.
 */
export async function getFileContent(sessionId: string, path: string, ref: string) {
    if (HASH_RE.test(ref)) {
        const key = blobKey(sessionId, ref);
        const cached = await cacheGetJSON<CachedBlob>(key);
        if (cached) {
            return { content: cached.content, binary: cached.binary, hash: ref };
        }
    }
    const result = await dbGetFileContent(sessionId, path, ref);
    if (result) {
        await cacheSetJSON(
            blobKey(sessionId, result.hash),
            { content: result.content, binary: result.binary } satisfies CachedBlob,
            BLOB_CACHE_TTL
        );
    }
    return result;
}

/**
 * Assembles the full initial payload for a connecting viewer: the session
 * record, the current metadata tree, recent checkpoint summaries, and the
 * load mode. In eager mode a hash → content map is also included so the
 * viewer can open files instantly without per-file fetches.
 */
export async function buildSessionState(sessionId: string) {
    const raw = await dbGetSession(sessionId);
    if (!raw) {
        return null;
    }
    const session = withLiveness(raw);

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
    // Start the cross-instance bridge on first viewer; remote events are
    // replayed into the same local fan-out. No-op when Redis is off / started.
    ensureSubscriber(emitSessionEvent);

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
    // Status is now "ended" — invalidate before any reader can re-cache active.
    await cacheDel(sessionKey(sessionId));

    broadcastSessionEvent(sessionId, {
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
    broadcastSessionEvent(sessionId, { type: "checkpoint", payload: checkpoint });
}

export type CheckpointChangeCalculation = {
    changes: CheckpointChange[];
    headUpserts: HeadUpdate[];
    headDeletes: string[];
    newBlobs: Map<string, BlobInput>;
    additions: number;
    deletions: number;
};

/**
 * Pure calculation step for a checkpoint upload. Resolves prior file heads and
 * blob content through the provided reader seams so the function can be tested
 * with in-memory adapters without a live database.
 *
 * Two adapters justify the seam: the real DB readers in production, and
 * in-memory maps in tests.
 */
export async function calculateCheckpointChanges(
    entries: CheckpointUpload["entries"],
    readHead: (path: string) => Promise<{ hash: string; binary: boolean } | null>,
    readBlob: (hash: string) => Promise<{ content: string; binary: boolean } | null>
): Promise<CheckpointChangeCalculation> {
    const changes: CheckpointChange[] = [];
    const headUpserts: HeadUpdate[] = [];
    const headDeletes: string[] = [];
    const newBlobs = new Map<string, BlobInput>();
    let additions = 0;
    let deletions = 0;

    for (const entry of entries) {
        if (entry.changeType === "deleted") {
            const prior = await readHead(entry.path);
            const beforeHash = prior?.hash ?? null;
            let del = 0;
            if (prior && !prior.binary && beforeHash) {
                const blob = await readBlob(beforeHash);
                del = blob && !blob.binary ? countLines(blob.content) : 0;
            }
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

        const prior = await readHead(entry.path);
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
                const before = beforeHash ? await readBlob(beforeHash) : null;
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

    return { changes, headUpserts, headDeletes, newBlobs, additions, deletions };
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
            let del = 0;
            if (!prior.binary) {
                const blob = await dbGetBlob(sessionId, prior.hash);
                del = blob && !blob.binary ? countLines(blob.content) : 0;
            }
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
        const seq =
            (await nextCheckpointSeq(sessionId, () => Promise.resolve(maxSeq))) ??
            maxSeq + 1;
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
        broadcastSessionEvent(sessionId, {
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
        broadcastSessionEvent(sessionId, {
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

    const { changes, headUpserts, headDeletes, newBlobs, additions, deletions } =
        await calculateCheckpointChanges(
            payload.entries,
            (path) => dbGetFileHead(sessionId, path),
            (hash) => readBlobCached(sessionId, hash)
        );

    if (changes.length === 0) {
        return { ok: true };
    }

    const seq =
        (await nextCheckpointSeq(sessionId, () =>
            dbGetMaxCheckpointSeq(sessionId)
        )) ?? (await dbGetMaxCheckpointSeq(sessionId)) + 1;
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
