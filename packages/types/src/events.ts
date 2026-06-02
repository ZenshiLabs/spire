import { z } from "zod/v4";
import { DeltaPayloadSchema } from "./delta.js";
import { FileSnapshotSchema } from "./file.js";

export const ConnectedEventSchema = z.object({
    type: z.literal("connected"),
    sessionId: z.string().uuid(),
    timestamp: z.number().int().positive(),
});
export type ConnectedEvent = z.infer<typeof ConnectedEventSchema>;

export const DeltaEventSchema = z.object({
    type: z.literal("delta"),
    payload: DeltaPayloadSchema,
});
export type DeltaEvent = z.infer<typeof DeltaEventSchema>;

export const SnapshotEventSchema = z.object({
    type: z.literal("snapshot"),
    payload: FileSnapshotSchema,
});
export type SnapshotEvent = z.infer<typeof SnapshotEventSchema>;

export const SessionEndedEventSchema = z.object({
    type: z.literal("session_ended"),
    sessionId: z.string().uuid(),
    timestamp: z.number().int().positive(),
});
export type SessionEndedEvent = z.infer<typeof SessionEndedEventSchema>;

export const SSEEventSchema = z.discriminatedUnion("type", [
    ConnectedEventSchema,
    DeltaEventSchema,
    SnapshotEventSchema,
    SessionEndedEventSchema,
]);
export type SSEEvent = z.infer<typeof SSEEventSchema>;
