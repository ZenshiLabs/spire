import type { FileNode } from "@spire/types";
import { sql } from "drizzle-orm";
import {
    boolean,
    check,
    customType,
    foreignKey,
    index,
    integer,
    jsonb,
    pgTable,
    primaryKey,
    serial,
    text,
    timestamp,
    unique,
} from "drizzle-orm/pg-core";

/**
 * Postgres `bytea` column mapped to a Node `Buffer`. drizzle-orm has no native
 * bytea helper. Values are sent to the driver as a hex string (`\x…`), which
 * Postgres' bytea input accepts; Neon's HTTP driver returns bytea as that same
 * hex-string form, so we decode it back to a Buffer on read (and pass Buffers
 * through unchanged, in case a driver ever hands one back directly).
 */
const bytea = customType<{ data: Buffer; driverData: string | Uint8Array }>({
    dataType() {
        return "bytea";
    },
    toDriver(value: Buffer): string {
        return "\\x" + value.toString("hex");
    },
    fromDriver(value: string | Uint8Array): Buffer {
        // Neon's HTTP driver returns bytea as a hex string ("\\x…"); guard the
        // other shapes a driver could hand back (a Buffer, or a bare typed
        // array) so reads never depend on one exact representation.
        if (typeof value === "string") {
            return value.startsWith("\\x")
                ? Buffer.from(value.slice(2), "hex")
                : Buffer.from(value, "binary");
        }
        return Buffer.isBuffer(value) ? value : Buffer.from(value);
    },
});

/** Broadcast sessions. Mirrors the shape of SessionResponse. */
export const sessions = pgTable(
    "sessions",
    {
        id: text("id").primaryKey(),
        title: text("title").notNull(),
        description: text("description"),
        status: text("status", { enum: ["active", "ended"] })
            .notNull()
            .default("active"),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        endedAt: timestamp("ended_at", { withTimezone: true }),
        // Links sessions started together from one `spire.json` workspace.
        // Nullable; a future GET /api/groups/:groupId/sessions can surface a
        // sibling-sessions rail in the viewer.
        groupId: text("group_id"),
    },
    (table) => [
        // Drizzle's text({ enum }) is a TypeScript-only type; enforce the
        // allowed values at the database so non-ORM writers can't drift.
        check(
            "sessions_status_chk",
            sql`${table.status} in ('active', 'ended')`
        ),
        index("sessions_group_id").on(table.groupId),
        // Serves the cleanup cron: find active sessions gone stale, and ended
        // sessions past their retention window.
        index("sessions_status_updated").on(table.status, table.updatedAt),
        index("sessions_status_ended").on(table.status, table.endedAt),
    ]
);

/**
 * The single current file-tree snapshot per session (upserted on ingest). The
 * tree is metadata-only: file `content` is stripped before storage and lives in
 * `blobs`, addressed by hash.
 */
export const snapshots = pgTable(
    "snapshots",
    {
        sessionId: text("session_id")
            .primaryKey()
            .references(() => sessions.id, { onDelete: "cascade" }),
        tree: jsonb("tree").$type<FileNode>().notNull(),
        sequenceNum: integer("sequence_num").notNull().default(0),
        timestamp: timestamp("timestamp", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        check("snapshots_sequence_num_chk", sql`${table.sequenceNum} >= 0`),
    ]
);

/**
 * Content-addressed file contents. Each unique (session, sha-256) is stored
 * once and referenced by hash from snapshots, files, and checkpoint changes —
 * so re-saving a file to a prior state costs nothing. Binary files are recorded
 * with `binary = true` and empty content (their bytes are never embedded).
 *
 * `content` holds the stored bytes; `compression` records how they are encoded
 * (`"none"` = raw UTF-8, `"br"` = brotli). Both are transparent to callers —
 * the queries layer compresses on write and decodes back to a string on read.
 * `hash` and `size` always describe the raw (uncompressed) content, so dedup
 * and reported sizes are unaffected by the encoding.
 */
export const blobs = pgTable(
    "blobs",
    {
        sessionId: text("session_id")
            .notNull()
            .references(() => sessions.id, { onDelete: "cascade" }),
        hash: text("hash").notNull(),
        content: bytea("content").notNull(),
        compression: text("compression", { enum: ["none", "br"] })
            .notNull()
            .default("none"),
        size: integer("size").notNull(),
        binary: boolean("binary").notNull().default(false),
    },
    (table) => [
        primaryKey({ columns: [table.sessionId, table.hash] }),
        check("blobs_size_chk", sql`${table.size} >= 0`),
    ]
);

/**
 * Append-only history of checkpoints (save-bursts). `seq` is server-assigned
 * and monotonic per session; seq 0 is the initial snapshot.
 */
export const checkpoints = pgTable(
    "checkpoints",
    {
        id: serial("id").primaryKey(),
        sessionId: text("session_id")
            .notNull()
            .references(() => sessions.id, { onDelete: "cascade" }),
        seq: integer("seq").notNull(),
        label: text("label").notNull(),
        additions: integer("additions").notNull().default(0),
        deletions: integer("deletions").notNull().default(0),
        filesChanged: integer("files_changed").notNull().default(0),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        unique("checkpoints_session_seq").on(table.sessionId, table.seq),
        check(
            "checkpoints_counts_chk",
            sql`${table.seq} >= 0 and ${table.additions} >= 0 and ${table.deletions} >= 0 and ${table.filesChanged} >= 0`
        ),
    ]
);

/**
 * Per-file changes within a checkpoint. Keyed by (session, checkpointSeq)
 * rather than a serial FK so a checkpoint and its changes can be written in one
 * atomic `db.batch()` without an intermediate id round-trip (Neon's HTTP driver
 * has no interactive transactions). Content is referenced by before/after hash.
 *
 * The composite FK to checkpoints(session_id, seq) — whose unique index makes
 * it a valid reference target — is still satisfied inside the batch, since the
 * checkpoint row is the first op in `dbWriteCheckpoint`.
 */
export const checkpointChanges = pgTable(
    "checkpoint_changes",
    {
        id: serial("id").primaryKey(),
        sessionId: text("session_id")
            .notNull()
            .references(() => sessions.id, { onDelete: "cascade" }),
        checkpointSeq: integer("checkpoint_seq").notNull(),
        path: text("path").notNull(),
        changeType: text("change_type", {
            enum: ["added", "modified", "deleted", "renamed"],
        }).notNull(),
        oldPath: text("old_path"),
        beforeHash: text("before_hash"),
        afterHash: text("after_hash"),
        additions: integer("additions").notNull().default(0),
        deletions: integer("deletions").notNull().default(0),
        binary: boolean("binary").notNull().default(false),
    },
    (table) => [
        foreignKey({
            columns: [table.sessionId, table.checkpointSeq],
            foreignColumns: [checkpoints.sessionId, checkpoints.seq],
            name: "checkpoint_changes_ckpt_fk",
        }).onDelete("cascade"),
        // Serves dbGetCheckpoint (all changes for one checkpoint).
        index("checkpoint_changes_session_seq").on(
            table.sessionId,
            table.checkpointSeq
        ),
        // Serves dbResolveHashAtSeq (per-path history blame, ordered by seq).
        index("checkpoint_changes_session_path_seq").on(
            table.sessionId,
            table.path,
            table.checkpointSeq
        ),
        check(
            "checkpoint_changes_type_chk",
            sql`${table.changeType} in ('added', 'modified', 'deleted', 'renamed')`
        ),
        // A deletion carries no resulting content; every other change does.
        check(
            "checkpoint_changes_after_hash_chk",
            sql`(${table.changeType} = 'deleted') = (${table.afterHash} is null)`
        ),
        check(
            "checkpoint_changes_counts_chk",
            sql`${table.additions} >= 0 and ${table.deletions} >= 0`
        ),
    ]
);

/** Current ("head") version of every live file, for fast tree + lazy lookups. */
export const files = pgTable(
    "files",
    {
        sessionId: text("session_id")
            .notNull()
            .references(() => sessions.id, { onDelete: "cascade" }),
        path: text("path").notNull(),
        hash: text("hash").notNull(),
        size: integer("size").notNull(),
        binary: boolean("binary").notNull().default(false),
    },
    (table) => [
        primaryKey({ columns: [table.sessionId, table.path] }),
        // Every head file must point to real content. Cascade (not restrict)
        // so a session-delete cascade through blobs can't be blocked by a head
        // row still referencing them.
        foreignKey({
            columns: [table.sessionId, table.hash],
            foreignColumns: [blobs.sessionId, blobs.hash],
            name: "files_blob_fk",
        }).onDelete("cascade"),
        check("files_size_chk", sql`${table.size} >= 0`),
    ]
);

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type SnapshotRow = typeof snapshots.$inferSelect;
export type BlobRow = typeof blobs.$inferSelect;
export type CheckpointRow = typeof checkpoints.$inferSelect;
export type CheckpointChangeRow = typeof checkpointChanges.$inferSelect;
export type FileRow = typeof files.$inferSelect;
