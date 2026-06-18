import type {
    Checkpoint,
    CheckpointChange,
    CheckpointSummary,
    CreateSessionInput,
    FileNode,
    FileSnapshot,
    SessionResponse,
} from "@spire/types";
import { HASH_RE } from "@spire/types";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";

import { getDb } from "./client.js";
import {
    blobs,
    checkpointChanges,
    checkpoints,
    files,
    sessions,
    snapshots,
    type CheckpointChangeRow,
    type CheckpointRow,
    type FileRow,
    type SessionRow,
} from "./schema.js";

function toSessionResponse(row: SessionRow): SessionResponse {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    };
}

export async function dbGetSession(
    sessionId: string
): Promise<SessionResponse | null> {
    const db = getDb();
    const [row] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1);
    return row ? toSessionResponse(row) : null;
}

/**
 * Creates the session if it does not exist, or reactivates an ended one.
 * Idempotent: keeps the existing title and description unless the input
 * overrides them, and always flips status back to "active". Safe to call on
 * every `spire start` — the CLI relies on this to rejoin without history loss.
 */
export async function dbUpsertSession(
    sessionId: string,
    input: CreateSessionInput
): Promise<SessionResponse> {
    const db = getDb();
    const now = new Date();
    const [existing] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1);

    if (existing) {
        const [row] = await db
            .update(sessions)
            .set({
                title: input.title ?? existing.title,
                description: input.description ?? existing.description,
                status: "active",
                updatedAt: now,
                endedAt: null,
            })
            .where(eq(sessions.id, sessionId))
            .returning();
        if (!row) {
            throw new Error(`Failed to update session ${sessionId}`);
        }
        return toSessionResponse(row);
    }

    const [row] = await db
        .insert(sessions)
        .values({
            id: sessionId,
            title: input.title ?? sessionId,
            description: input.description ?? null,
            status: "active",
        })
        .returning();
    if (!row) {
        throw new Error(`Failed to create session ${sessionId}`);
    }
    return toSessionResponse(row);
}

export async function dbEndSession(
    sessionId: string
): Promise<SessionResponse | null> {
    const db = getDb();
    const now = new Date();
    const [row] = await db
        .update(sessions)
        .set({ status: "ended", endedAt: now, updatedAt: now })
        .where(eq(sessions.id, sessionId))
        .returning();
    return row ? toSessionResponse(row) : null;
}

export async function dbTouchSession(sessionId: string): Promise<void> {
    const db = getDb();
    await db
        .update(sessions)
        .set({ updatedAt: new Date() })
        .where(eq(sessions.id, sessionId));
}

export async function dbGetSnapshot(
    sessionId: string
): Promise<FileSnapshot | null> {
    const db = getDb();
    const [row] = await db
        .select()
        .from(snapshots)
        .where(eq(snapshots.sessionId, sessionId))
        .limit(1);
    if (!row) {
        return null;
    }
    return {
        sessionId: row.sessionId,
        tree: row.tree,
        timestamp: row.timestamp.getTime(),
        sequenceNum: row.sequenceNum,
    };
}

/**
 * Upserts the single current snapshot tree for a session. Only the metadata
 * tree is stored here — file content is stripped before this call and lives
 * in the blobs table addressed by SHA-256 hash.
 */
export async function dbSaveSnapshotTree(
    sessionId: string,
    tree: FileNode,
    sequenceNum: number,
    timestamp: Date
): Promise<void> {
    const db = getDb();
    await db
        .insert(snapshots)
        .values({ sessionId, tree, sequenceNum, timestamp })
        .onConflictDoUpdate({
            target: snapshots.sessionId,
            set: { tree, sequenceNum, timestamp },
        });
}

export type BlobInput = {
    hash: string;
    content: string;
    size: number;
    binary: boolean;
};

/**
 * Maximum number of blobs inserted per statement. Chunking keeps each
 * request under Neon's HTTP request-size ceiling on large initial snapshots.
 */
const BLOB_CHUNK = 100;

export async function dbUpsertBlobs(
    sessionId: string,
    inputs: BlobInput[]
): Promise<void> {
    if (inputs.length === 0) {
        return;
    }
    const db = getDb();
    for (let i = 0; i < inputs.length; i += BLOB_CHUNK) {
        const chunk = inputs.slice(i, i + BLOB_CHUNK);
        await db
            .insert(blobs)
            .values(chunk.map((b) => ({ sessionId, ...b })))
            .onConflictDoNothing();
    }
}

export async function dbGetBlob(
    sessionId: string,
    hash: string
): Promise<{ content: string; binary: boolean; size: number } | null> {
    const db = getDb();
    const [row] = await db
        .select({
            content: blobs.content,
            binary: blobs.binary,
            size: blobs.size,
        })
        .from(blobs)
        .where(and(eq(blobs.sessionId, sessionId), eq(blobs.hash, hash)))
        .limit(1);
    return row ?? null;
}

export async function dbGetFilesHead(sessionId: string): Promise<FileRow[]> {
    const db = getDb();
    return db.select().from(files).where(eq(files.sessionId, sessionId));
}

export async function dbGetFileHead(
    sessionId: string,
    path: string
): Promise<FileRow | null> {
    const db = getDb();
    const [row] = await db
        .select()
        .from(files)
        .where(and(eq(files.sessionId, sessionId), eq(files.path, path)))
        .limit(1);
    return row ?? null;
}

export async function dbGetMaxCheckpointSeq(
    sessionId: string
): Promise<number> {
    const db = getDb();
    const [row] = await db
        .select({ max: sql<number | null>`max(${checkpoints.seq})` })
        .from(checkpoints)
        .where(eq(checkpoints.sessionId, sessionId));
    const max = row?.max;
    return max === null || max === undefined ? -1 : Number(max);
}

export type HeadUpdate = {
    path: string;
    hash: string;
    size: number;
    binary: boolean;
};

/**
 * Atomically persists a checkpoint, its per-file changes, any new blobs, and
 * the resulting head-file state in a single `db.batch()` call. Neon's HTTP
 * driver has no interactive transactions, so `seq` is assigned by the caller
 * from `dbGetMaxCheckpointSeq` before this call. The unique (sessionId, seq)
 * index on the checkpoints table acts as a guard against the rare race where
 * two concurrent writes land the same sequence number.
 */
export async function dbWriteCheckpoint(args: {
    sessionId: string;
    seq: number;
    label: string;
    createdAt: Date;
    additions: number;
    deletions: number;
    filesChanged: number;
    changes: CheckpointChange[];
    headUpserts: HeadUpdate[];
    headDeletes: string[];
    newBlobs: BlobInput[];
}): Promise<void> {
    const db = getDb();
    const { sessionId, seq } = args;

    const ops: unknown[] = [
        db.insert(checkpoints).values({
            sessionId,
            seq,
            label: args.label,
            additions: args.additions,
            deletions: args.deletions,
            filesChanged: args.filesChanged,
            createdAt: args.createdAt,
        }),
    ];

    if (args.newBlobs.length > 0) {
        ops.push(
            db
                .insert(blobs)
                .values(args.newBlobs.map((b) => ({ sessionId, ...b })))
                .onConflictDoNothing()
        );
    }

    if (args.changes.length > 0) {
        ops.push(
            db.insert(checkpointChanges).values(
                args.changes.map((c) => ({
                    sessionId,
                    checkpointSeq: seq,
                    path: c.path,
                    changeType: c.changeType,
                    oldPath: c.oldPath ?? null,
                    beforeHash: c.beforeHash,
                    afterHash: c.afterHash,
                    additions: c.additions,
                    deletions: c.deletions,
                    binary: c.binary ?? false,
                }))
            )
        );
    }

    if (args.headUpserts.length > 0) {
        ops.push(
            db
                .insert(files)
                .values(args.headUpserts.map((h) => ({ sessionId, ...h })))
                .onConflictDoUpdate({
                    target: [files.sessionId, files.path],
                    set: {
                        hash: sql`excluded.hash`,
                        size: sql`excluded.size`,
                        binary: sql`excluded.binary`,
                    },
                })
        );
    }

    if (args.headDeletes.length > 0) {
        ops.push(
            db
                .delete(files)
                .where(
                    and(
                        eq(files.sessionId, sessionId),
                        inArray(files.path, args.headDeletes)
                    )
                )
        );
    }

    await db.batch(ops as unknown as Parameters<typeof db.batch>[0]);
}

function toCheckpointSummary(row: CheckpointRow): CheckpointSummary {
    return {
        sessionId: row.sessionId,
        seq: row.seq,
        label: row.label,
        createdAt: row.createdAt.toISOString(),
        filesChanged: row.filesChanged,
        additions: row.additions,
        deletions: row.deletions,
    };
}

function toCheckpointChange(row: CheckpointChangeRow): CheckpointChange {
    return {
        path: row.path,
        changeType: row.changeType,
        oldPath: row.oldPath ?? undefined,
        beforeHash: row.beforeHash,
        afterHash: row.afterHash,
        additions: row.additions,
        deletions: row.deletions,
        binary: row.binary,
    };
}

export async function dbGetCheckpoints(
    sessionId: string,
    opts: { limit?: number; beforeSeq?: number } = {}
): Promise<CheckpointSummary[]> {
    const db = getDb();
    const conditions = [eq(checkpoints.sessionId, sessionId)];
    if (opts.beforeSeq !== undefined) {
        conditions.push(lt(checkpoints.seq, opts.beforeSeq));
    }
    const rows = await db
        .select()
        .from(checkpoints)
        .where(and(...conditions))
        .orderBy(desc(checkpoints.seq))
        .limit(opts.limit ?? 100);
    return rows.map(toCheckpointSummary);
}

export async function dbGetCheckpoint(
    sessionId: string,
    seq: number
): Promise<Checkpoint | null> {
    const db = getDb();
    const [row] = await db
        .select()
        .from(checkpoints)
        .where(
            and(eq(checkpoints.sessionId, sessionId), eq(checkpoints.seq, seq))
        )
        .limit(1);
    if (!row) {
        return null;
    }
    const changeRows = await db
        .select()
        .from(checkpointChanges)
        .where(
            and(
                eq(checkpointChanges.sessionId, sessionId),
                eq(checkpointChanges.checkpointSeq, seq)
            )
        )
        .orderBy(asc(checkpointChanges.id));
    return {
        ...toCheckpointSummary(row),
        changes: changeRows.map(toCheckpointChange),
    };
}

/**
 * Resolves the content hash a file path had at or before a given checkpoint
 * sequence number. Returns null if the file did not exist at that point in
 * history (i.e. it was added after `seq` or was deleted).
 */
export async function dbResolveHashAtSeq(
    sessionId: string,
    path: string,
    seq: number
): Promise<string | null> {
    const db = getDb();
    const [row] = await db
        .select({
            afterHash: checkpointChanges.afterHash,
            changeType: checkpointChanges.changeType,
        })
        .from(checkpointChanges)
        .where(
            and(
                eq(checkpointChanges.sessionId, sessionId),
                eq(checkpointChanges.path, path),
                lt(checkpointChanges.checkpointSeq, seq + 1)
            )
        )
        .orderBy(desc(checkpointChanges.checkpointSeq))
        .limit(1);
    if (!row || row.changeType === "deleted") {
        return null;
    }
    return row.afterHash;
}

/**
 * Resolves a file's content for a given `ref`. `ref` may be a 64-hex SHA-256
 * blob hash for a direct lookup, the literal string "latest" to fetch the
 * current head version, or a checkpoint sequence number (as a string) to
 * retrieve the file as it existed at that point in the session history.
 */
export async function dbGetFileContent(
    sessionId: string,
    path: string,
    ref: string
): Promise<{ content: string; binary: boolean; hash: string } | null> {
    let hash: string | null;
    if (HASH_RE.test(ref)) {
        hash = ref;
    } else if (ref === "latest") {
        const head = await dbGetFileHead(sessionId, path);
        hash = head?.hash ?? null;
    } else {
        const seq = Number(ref);
        hash = Number.isFinite(seq)
            ? await dbResolveHashAtSeq(sessionId, path, seq)
            : null;
    }
    if (!hash) {
        return null;
    }
    const blob = await dbGetBlob(sessionId, hash);
    return blob
        ? { content: blob.content, binary: blob.binary, hash }
        : null;
}

export async function dbGetSessionStats(
    sessionId: string
): Promise<{ fileCount: number; totalSize: number }> {
    const db = getDb();
    const [row] = await db
        .select({
            count: sql<number>`count(*)`,
            total: sql<number>`coalesce(sum(${files.size}), 0)`,
        })
        .from(files)
        .where(eq(files.sessionId, sessionId));
    return {
        fileCount: Number(row?.count ?? 0),
        totalSize: Number(row?.total ?? 0),
    };
}

/**
 * Returns a hash → content map for all current text files in a session.
 * Used to pre-fill the viewer's content-addressed LRU cache on load in
 * eager mode, enabling instant file opens without per-file round-trips.
 */
export async function dbGetHeadContents(
    sessionId: string
): Promise<Record<string, string>> {
    const db = getDb();
    const rows = await db
        .select({ hash: blobs.hash, content: blobs.content })
        .from(files)
        .innerJoin(
            blobs,
            and(eq(blobs.sessionId, files.sessionId), eq(blobs.hash, files.hash))
        )
        .where(and(eq(files.sessionId, sessionId), eq(blobs.binary, false)));
    const map: Record<string, string> = {};
    for (const row of rows) {
        map[row.hash] = row.content;
    }
    return map;
}
