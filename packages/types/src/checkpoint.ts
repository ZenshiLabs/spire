import { z } from "zod/v4";

export const ChangeTypeSchema = z.enum([
    "added",
    "modified",
    "deleted",
    "renamed",
]);
export type ChangeType = z.infer<typeof ChangeTypeSchema>;

/**
 * Describes how a single file changed within a checkpoint. Content is never
 * inlined — `beforeHash` and `afterHash` reference content-addressed blobs
 * so the viewer fetches each version on demand and renders diffs client-side
 * without the server needing to transmit file bytes in the event stream.
 */
export const CheckpointChangeSchema = z.object({
    path: z.string().min(1),
    changeType: ChangeTypeSchema,
    oldPath: z.string().optional(),
    beforeHash: z.string().length(64).nullable(),
    afterHash: z.string().length(64).nullable(),
    additions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative(),
    binary: z.boolean().optional(),
});
export type CheckpointChange = z.infer<typeof CheckpointChangeSchema>;

/**
 * A checkpoint represents one save-burst worth of file changes. The CLI groups
 * events from the file watcher into batches and the server assigns a monotonic
 * `seq` number per session. Checkpoint 0 is always the initial snapshot
 * (every file "added"); subsequent checkpoints record incremental changes.
 */
export const CheckpointSchema = z.object({
    sessionId: z.string().min(1),
    seq: z.number().int().nonnegative(),
    label: z.string(),
    createdAt: z.string(),
    filesChanged: z.number().int().nonnegative(),
    additions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative(),
    changes: z.array(CheckpointChangeSchema),
});
export type Checkpoint = z.infer<typeof CheckpointSchema>;

/**
 * A checkpoint without its per-file change list. Used for the history panel
 * list and SSE checkpoint-summary frames where the full change list is not
 * needed until the user clicks into a specific checkpoint.
 */
export const CheckpointSummarySchema = CheckpointSchema.omit({ changes: true });
export type CheckpointSummary = z.infer<typeof CheckpointSummarySchema>;

/**
 * One revision of a single file: the checkpoint that touched it plus how it
 * changed there. Returned newest-first by the per-file history endpoint and
 * rendered in the viewer's per-file timeline, where a revision can be chosen
 * as the baseline for the editor's diff mode.
 */
export const FileHistoryEntrySchema = z.object({
    seq: z.number().int().nonnegative(),
    label: z.string(),
    createdAt: z.string(),
    changeType: ChangeTypeSchema,
    beforeHash: z.string().length(64).nullable(),
    afterHash: z.string().length(64).nullable(),
    additions: z.number().int().nonnegative(),
    deletions: z.number().int().nonnegative(),
    binary: z.boolean(),
});
export type FileHistoryEntry = z.infer<typeof FileHistoryEntrySchema>;

/**
 * A single file entry in a checkpoint upload payload sent by the CLI.
 * The CLI provides only the new content and its hash; the server resolves the
 * prior version, computes diff stats, and writes the checkpoint atomically.
 * `content` is omitted for deletions and for binary files.
 */
export const CheckpointManifestEntrySchema = z.object({
    path: z.string().min(1),
    changeType: ChangeTypeSchema,
    oldPath: z.string().optional(),
    hash: z.string().length(64).nullable(),
    size: z.number().int().nonnegative(),
    binary: z.boolean().optional(),
    content: z.string().optional(),
});
export type CheckpointManifestEntry = z.infer<
    typeof CheckpointManifestEntrySchema
>;

/**
 * The full checkpoint upload payload sent from the CLI to the server. Contains
 * all file changes in the current save burst as a flat array of manifest entries.
 */
export const CheckpointUploadSchema = z.object({
    sessionId: z.string().min(1),
    entries: z.array(CheckpointManifestEntrySchema).min(1),
    timestamp: z.number().int().positive(),
});
export type CheckpointUpload = z.infer<typeof CheckpointUploadSchema>;
