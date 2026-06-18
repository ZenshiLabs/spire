import { z } from "zod/v4";
import { CheckpointSchema } from "./checkpoint.js";
import { FileSnapshotSchema } from "./file.js";

export const ConnectedEventSchema = z.object({
    type: z.literal("connected"),
    sessionId: z.string().min(1),
    timestamp: z.number().int().positive(),
});
export type ConnectedEvent = z.infer<typeof ConnectedEventSchema>;

/**
 * Live SSE notification that a new checkpoint landed. Carries the full per-file
 * change list (metadata only — before/after hashes, never content) so the viewer
 * can update the tree decorations, head hashes, and history panel without an
 * additional fetch.
 */
export const CheckpointEventSchema = z.object({
    type: z.literal("checkpoint"),
    payload: CheckpointSchema,
});
export type CheckpointEvent = z.infer<typeof CheckpointEventSchema>;

/**
 * Sent when the CLI uploads a fresh snapshot — on initial connect and on every
 * CLI rejoin. The viewer replaces its entire tree state with the new snapshot
 * to stay consistent with the broadcaster's local file system.
 */
export const SnapshotEventSchema = z.object({
    type: z.literal("snapshot"),
    payload: FileSnapshotSchema,
});
export type SnapshotEvent = z.infer<typeof SnapshotEventSchema>;

export const SessionEndedEventSchema = z.object({
    type: z.literal("session_ended"),
    sessionId: z.string().min(1),
    timestamp: z.number().int().positive(),
});
export type SessionEndedEvent = z.infer<typeof SessionEndedEventSchema>;

export const SSEEventSchema = z.discriminatedUnion("type", [
    ConnectedEventSchema,
    CheckpointEventSchema,
    SnapshotEventSchema,
    SessionEndedEventSchema,
]);
export type SSEEvent = z.infer<typeof SSEEventSchema>;
