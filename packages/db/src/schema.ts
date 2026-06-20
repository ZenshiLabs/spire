import type { FileNode } from "@spire/types";
import { sql } from "drizzle-orm";
import {
    boolean,
    check,
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
    },
    (table) => [
        // Drizzle's text({ enum }) is a TypeScript-only type; enforce the
        // allowed values at the database so non-ORM writers can't drift.
        check(
            "sessions_status_chk",
            sql`${table.status} in ('active', 'ended')`
        ),
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
 */
export const blobs = pgTable(
    "blobs",
    {
        sessionId: text("session_id")
            .notNull()
            .references(() => sessions.id, { onDelete: "cascade" }),
        hash: text("hash").notNull(),
        content: text("content").notNull(),
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
