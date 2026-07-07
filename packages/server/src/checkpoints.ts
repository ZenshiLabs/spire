import * as DB from "@spire/db";
import type { BlobInput, HeadUpdate } from "@spire/db";
import { RedisService } from "@spire/redis";
import {
    baseName,
    insertFile,
    sortTree,
    type ChangeType,
    type Checkpoint,
    type CheckpointChange,
    type CheckpointUpload,
    type FileNode,
    type FileSnapshot,
    type SessionResponse,
} from "@spire/types";
import { diffLines } from "diff";
import { Effect } from "effect";

import { nextSeq, resetSeq } from "./cache.js";
import { fromDb } from "./db.js";
import { DbError } from "./errors.js";
import { type CachedBlob, readBlobsCached } from "./files.js";
import { broadcastSessionEvent, emitLocalEvent } from "./pubsub.js";

/** Postgres unique-violation SQLSTATE, raised by the (sessionId, seq) index. */
const UNIQUE_VIOLATION = "23505";

function isSeqConflict(error: DbError): boolean {
    const cause = error.cause as { code?: string } | null;
    return cause?.code === UNIQUE_VIOLATION;
}

/**
 * Persists a checkpoint, retrying with a freshly-computed sequence number if a
 * concurrent writer claimed the same `seq` first. The Redis fast-path counter
 * (`nextSeq`) can hand out a stale value when it is unavailable or racing —
 * without Redis both writers fall back to `maxSeq + 1` and collide — so the
 * unique index on (sessionId, seq) is the correctness backstop and this loop
 * turns a collision into a retry instead of a dropped checkpoint. Returns the
 * `seq` that actually landed so callers can build the broadcast payload from it.
 *
 * Accepted residual: two CLIs sharing one `--session` still get last-write-wins
 * on the head-file rows, which is fine for a broadcast tool.
 */
const writeCheckpointWithSeqRetry = (
    sessionId: string,
    initialSeq: number,
    buildArgs: (seq: number) => Parameters<typeof DB.dbWriteCheckpoint>[0]
): Effect.Effect<number, DbError, RedisService> =>
    Effect.gen(function* () {
        const maxAttempts = 3;
        let seq = initialSeq;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const result = yield* Effect.either(
                fromDb("writeCheckpoint", () => DB.dbWriteCheckpoint(buildArgs(seq)))
            );
            if (result._tag === "Right") {
                return seq;
            }
            if (!isSeqConflict(result.left) || attempt >= maxAttempts) {
                return yield* Effect.fail(result.left);
            }
            yield* resetSeq(sessionId);
            const maxSeq = yield* fromDb("getMaxCheckpointSeq", () =>
                DB.dbGetMaxCheckpointSeq(sessionId)
            );
            seq = maxSeq + 1;
        }
        return seq;
    });

const EAGER_MAX_BYTES = Number(process.env.SPIRE_EAGER_MAX_BYTES) || 1.5 * 1024 * 1024;
const EAGER_MAX_FILES = Number(process.env.SPIRE_EAGER_MAX_FILES) || 400;

export type IngestResult =
    | { ok: true }
    | { ok: false; code: "not_found" | "inactive_session" };

export type LoadMode = "eager" | "lazy";

export type SessionStatePayload = {
    session: SessionResponse;
    snapshot: Awaited<ReturnType<typeof DB.dbGetSnapshot>>;
    checkpoints: Awaited<ReturnType<typeof DB.dbGetCheckpoints>>;
    mode: LoadMode;
    contents?: Awaited<ReturnType<typeof DB.dbGetHeadContents>>;
};

export type CheckpointChangeCalculation = {
    changes: CheckpointChange[];
    headUpserts: HeadUpdate[];
    headDeletes: string[];
    newBlobs: Map<string, BlobInput>;
    additions: number;
    deletions: number;
};

export const getCheckpoints = (
    sessionId: string,
    opts?: { limit?: number; beforeSeq?: number }
): Effect.Effect<Awaited<ReturnType<typeof DB.dbGetCheckpoints>>, DbError> =>
    fromDb("getCheckpoints", () => DB.dbGetCheckpoints(sessionId, opts));

export const getCheckpoint = (
    sessionId: string,
    seq: number
): Effect.Effect<Checkpoint | null, DbError> =>
    fromDb("getCheckpoint", () => DB.dbGetCheckpoint(sessionId, seq));

export const getFileHistory = (
    sessionId: string,
    path: string,
    opts?: { limit?: number; beforeSeq?: number }
): Effect.Effect<Awaited<ReturnType<typeof DB.dbGetFileHistory>>, DbError> =>
    fromDb("getFileHistory", () => DB.dbGetFileHistory(sessionId, path, opts));


function countLines(text: string): number {
    return text.length === 0 ? 0 : text.split("\n").length;
}

function countDiff(before: string, after: string): { add: number; del: number } {
    let add = 0;
    let del = 0;
    for (const part of diffLines(before, after)) {
        if (part.added) add += part.count ?? 0;
        else if (part.removed) del += part.count ?? 0;
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

function stripContent(node: FileNode): FileNode {
    if (node.type === "file") {
        const copy = { ...node };
        delete copy.content;
        return copy;
    }
    return { ...node, children: node.children.map(stripContent) };
}

function buildTreeFromHeadFiles(
    headFiles: Array<{ path: string; hash: string; size: number; binary: boolean }>
): FileNode {
    let root: FileNode = { type: "directory", name: "", path: "", children: [] };
    for (const f of headFiles) {
        root = insertFile(root, {
            type: "file",
            name: baseName(f.path),
            path: f.path,
            size: f.size,
            hash: f.hash,
            binary: f.binary || undefined,
        });
    }
    return sortTree(root);
}


export const buildSessionState = (
    sessionId: string
): Effect.Effect<SessionStatePayload | null, DbError, RedisService> =>
    Effect.gen(function* () {
        const raw = yield* fromDb("getSession", () => DB.dbGetSession(sessionId));
        if (!raw) return null;

        const SESSION_STALE_MS = Number(process.env.SPIRE_SESSION_STALE_MS) || 45_000;
        const stale =
            raw.status === "active" &&
            Date.now() - new Date(raw.updatedAt).getTime() > SESSION_STALE_MS;
        const session: SessionResponse = stale
            ? { ...raw, status: "ended", endedAt: raw.updatedAt }
            : raw;

        // All four queries are independent — run them in parallel.
        const [rawSnapshot, checkpoints, headFiles, stats] = yield* Effect.all(
            [
                fromDb("getSnapshot", () => DB.dbGetSnapshot(sessionId)),
                fromDb("getCheckpoints", () => DB.dbGetCheckpoints(sessionId, { limit: 200 })),
                fromDb("getFilesHead", () => DB.dbGetFilesHead(sessionId)),
                fromDb("getSessionStats", () => DB.dbGetSessionStats(sessionId)),
            ],
            { concurrency: "unbounded" }
        );

        const snapshot =
            rawSnapshot && headFiles.length > 0
                ? { ...rawSnapshot, tree: buildTreeFromHeadFiles(headFiles) }
                : rawSnapshot;

        const eager =
            stats.totalSize <= EAGER_MAX_BYTES && stats.fileCount <= EAGER_MAX_FILES;
        const contents = eager
            ? yield* fromDb("getHeadContents", () => DB.dbGetHeadContents(sessionId))
            : undefined;

        return { session, snapshot, checkpoints, mode: eager ? "eager" : "lazy", contents };
    });

/**
 * Computes the diff for a checkpoint upload. Takes batch adapter seams for head
 * and blob reads so the whole calculation issues at most two database round
 * trips — one for all touched heads, one for all prior blobs needed for line
 * counts — instead of a read per entry. The seams keep it testable with
 * in-memory adapters.
 */
export const calculateCheckpointChanges = (
    entries: CheckpointUpload["entries"],
    readHeads: (
        paths: string[]
    ) => Effect.Effect<Map<string, { hash: string; binary: boolean }>, DbError>,
    readBlobs: (
        hashes: string[]
    ) => Effect.Effect<Map<string, CachedBlob>, DbError, RedisService>
): Effect.Effect<CheckpointChangeCalculation, DbError, RedisService> =>
    Effect.gen(function* () {
        const heads = yield* readHeads(entries.map((entry) => entry.path));

        // Collect the prior hashes whose content we must read to count deleted
        // lines: text files that were deleted, or modified against a text prior.
        const neededHashes = new Set<string>();
        for (const entry of entries) {
            const prior = heads.get(entry.path);
            if (!prior || prior.binary) continue;
            if (entry.changeType === "deleted") {
                neededHashes.add(prior.hash);
            } else if (entry.hash && entry.hash !== prior.hash && !entry.binary) {
                neededHashes.add(prior.hash);
            }
        }
        const blobs = yield* readBlobs([...neededHashes]);

        const changes: CheckpointChange[] = [];
        const headUpserts: HeadUpdate[] = [];
        const headDeletes: string[] = [];
        const newBlobs = new Map<string, BlobInput>();
        let additions = 0;
        let deletions = 0;

        for (const entry of entries) {
            const prior = heads.get(entry.path) ?? null;
            const beforeHash = prior?.hash ?? null;

            if (entry.changeType === "deleted") {
                let del = 0;
                if (prior && !prior.binary && beforeHash) {
                    const blob = blobs.get(beforeHash);
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
            // No content hash, or unchanged from the current head: nothing to do.
            if (!afterHash || (prior && prior.hash === afterHash)) {
                continue;
            }

            let add = 0;
            let del = 0;
            if (!entry.binary) {
                const after = entry.content ?? "";
                if (!prior) {
                    add = countLines(after);
                } else {
                    const before = beforeHash ? blobs.get(beforeHash) : undefined;
                    ({ add, del } = countDiff(before?.content ?? "", after));
                }
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
    });

export const ingestSnapshot = (
    payload: FileSnapshot
): Effect.Effect<IngestResult, DbError, RedisService> =>
    Effect.gen(function* () {
        const sessionId = payload.sessionId;
        const session = yield* fromDb("getSession", () => DB.dbGetSession(sessionId));
        if (!session) return { ok: false as const, code: "not_found" as const };
        if (session.status !== "active")
            return { ok: false as const, code: "inactive_session" as const };

        const now = new Date(payload.timestamp);

        type HeadFile = { path: string; hash: string; size: number; binary: boolean };
        type IncomingFile = {
            path: string;
            hash: string;
            size: number;
            binary: boolean;
            content: string;
        };

        function extractFiles(node: FileNode, into: IncomingFile[] = []): IncomingFile[] {
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
            for (const child of node.children) extractFiles(child, into);
            return into;
        }

        const incoming = extractFiles(payload.tree);
        const incomingPaths = new Set(incoming.map((f) => f.path));

        // Fetch current head state and max seq in parallel.
        const [priorHead, maxSeq] = yield* Effect.all(
            [
                fromDb("getFilesHead", () => DB.dbGetFilesHead(sessionId)),
                fromDb("getMaxCheckpointSeq", () => DB.dbGetMaxCheckpointSeq(sessionId)),
            ],
            { concurrency: "unbounded" }
        );

        const priorByPath = new Map(priorHead.map((f: HeadFile) => [f.path, f]));
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

        // Blob upsert and snapshot tree write are independent — run in parallel.
        yield* Effect.all(
            [
                fromDb("upsertBlobs", () =>
                    DB.dbUpsertBlobs(sessionId, [...blobByHash.values()])
                ),
                fromDb("saveSnapshotTree", () =>
                    DB.dbSaveSnapshotTree(
                        sessionId,
                        stripContent(payload.tree),
                        payload.sequenceNum,
                        now
                    )
                ),
            ],
            { concurrency: "unbounded" }
        );

        // Count lines deleted from files no longer present in the snapshot.
        const deletedPriors = priorHead.filter((p: HeadFile) => !incomingPaths.has(p.path));

        // Collect every prior hash whose text content we need to count line
        // deltas — modified text files and deleted text files — then fetch them
        // all in one batched, cache-backed read instead of one query per file.
        const priorHashesNeeded = new Set<string>();
        for (const f of incoming) {
            const prior = priorByPath.get(f.path);
            if (prior && prior.hash !== f.hash && !f.binary && !prior.binary) {
                priorHashesNeeded.add(prior.hash);
            }
        }
        for (const prior of deletedPriors) {
            if (!prior.binary) {
                priorHashesNeeded.add(prior.hash);
            }
        }
        const priorBlobs = yield* readBlobsCached(sessionId, [...priorHashesNeeded]);

        const changes: CheckpointChange[] = [];
        const headUpserts: HeadUpdate[] = [];
        const headDeletes: string[] = [];
        let additions = 0;
        let deletions = 0;

        for (const f of incoming) {
            const prior = priorByPath.get(f.path);
            let add = 0;
            let del = 0;
            let kind: "added" | "modified" | "unchanged";
            if (!prior) {
                add = f.binary ? 0 : countLines(f.content);
                kind = "added";
            } else if (prior.hash === f.hash) {
                kind = "unchanged";
            } else {
                if (!f.binary && !prior.binary) {
                    const before = priorBlobs.get(prior.hash);
                    ({ add, del } = countDiff(before?.content ?? "", f.content));
                }
                kind = "modified";
            }
            if (kind === "unchanged") continue;
            additions += add;
            deletions += del;
            headUpserts.push({ path: f.path, hash: f.hash, size: f.size, binary: f.binary });
            changes.push({
                path: f.path,
                changeType: kind,
                beforeHash: prior?.hash ?? null,
                afterHash: f.hash,
                additions: add,
                deletions: del,
                binary: f.binary || undefined,
            });
        }

        // Emit deletions for files no longer in the snapshot, using the batched
        // prior blobs fetched above for line counts.
        for (const prior of deletedPriors) {
            let del = 0;
            if (!prior.binary) {
                const blob = priorBlobs.get(prior.hash);
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

        const snapshotEvent = {
            type: "snapshot" as const,
            payload: {
                sessionId,
                tree: stripContent(payload.tree),
                timestamp: payload.timestamp,
                sequenceNum: payload.sequenceNum,
            },
        };

        if (changes.length > 0) {
            const initialSeq =
                (yield* nextSeq(sessionId, () => Promise.resolve(maxSeq))) ?? maxSeq + 1;
            const label = isNew ? "Initial snapshot" : "Resumed session";
            const seq = yield* writeCheckpointWithSeqRetry(sessionId, initialSeq, (s) => ({
                sessionId,
                seq: s,
                label,
                createdAt: now,
                additions,
                deletions,
                filesChanged: changes.length,
                changes,
                headUpserts,
                headDeletes,
                newBlobs: [],
            }));
            yield* broadcastSessionEvent(sessionId, snapshotEvent);
            emitLocalEvent(sessionId, {
                type: "checkpoint",
                payload: {
                    sessionId,
                    seq,
                    label,
                    createdAt: now.toISOString(),
                    filesChanged: changes.length,
                    additions,
                    deletions,
                    changes,
                },
            });
        } else {
            yield* broadcastSessionEvent(sessionId, snapshotEvent);
        }

        yield* fromDb("touchSession", () => DB.dbTouchSession(sessionId));
        return { ok: true as const };
    });

export const ingestCheckpoint = (
    payload: CheckpointUpload
): Effect.Effect<IngestResult, DbError, RedisService> =>
    Effect.gen(function* () {
        const sessionId = payload.sessionId;
        const session = yield* fromDb("getSession", () => DB.dbGetSession(sessionId));
        if (!session) return { ok: false as const, code: "not_found" as const };
        if (session.status !== "active")
            return { ok: false as const, code: "inactive_session" as const };

        const now = new Date(payload.timestamp);

        const { changes, headUpserts, headDeletes, newBlobs, additions, deletions } =
            yield* calculateCheckpointChanges(
                payload.entries,
                (paths) =>
                    fromDb("getFileHeads", () => DB.dbGetFileHeads(sessionId, paths)).pipe(
                        Effect.map(
                            (rows) =>
                                new Map(
                                    rows.map((row) => [
                                        row.path,
                                        { hash: row.hash, binary: row.binary },
                                    ])
                                )
                        )
                    ),
                (hashes) => readBlobsCached(sessionId, hashes)
            );

        if (changes.length === 0) return { ok: true as const };

        const maxSeq = yield* fromDb("getMaxCheckpointSeq", () =>
            DB.dbGetMaxCheckpointSeq(sessionId)
        );
        const initialSeq = (yield* nextSeq(sessionId, () => Promise.resolve(maxSeq))) ?? maxSeq + 1;
        const label = buildLabel(changes);

        // Persist checkpoint (retrying on a seq collision) and bump the session
        // timestamp in parallel. The broadcast payload is built afterwards from
        // the seq that actually landed, which may differ from initialSeq.
        const [seq] = yield* Effect.all(
            [
                writeCheckpointWithSeqRetry(sessionId, initialSeq, (s) => ({
                    sessionId,
                    seq: s,
                    label,
                    createdAt: now,
                    additions,
                    deletions,
                    filesChanged: changes.length,
                    changes,
                    headUpserts,
                    headDeletes,
                    newBlobs: [...newBlobs.values()],
                })),
                fromDb("touchSession", () => DB.dbTouchSession(sessionId)),
            ],
            { concurrency: "unbounded" }
        );

        const checkpoint: Checkpoint = {
            sessionId,
            seq,
            label,
            createdAt: now.toISOString(),
            filesChanged: changes.length,
            additions,
            deletions,
            changes,
        };

        yield* broadcastSessionEvent(sessionId, { type: "checkpoint", payload: checkpoint });

        return { ok: true as const };
    });

