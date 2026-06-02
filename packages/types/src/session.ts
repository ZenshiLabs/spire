import { z } from "zod/v4";

export const SessionStatus = z.enum([
    "pending",
    "active",
    "ended",
    "expired",
]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const CreateSessionSchema = z.object({
    title: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    maxViewers: z.number().int().min(1).max(500).default(50),
});
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

export const SessionResponseSchema = z.object({
    id: z.string().uuid(),
    instructorId: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: SessionStatus,
    maxViewers: z.number().int(),
    viewerCount: z.number().int(),
    joinCode: z.string().length(8),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    endedAt: z.string().datetime().nullable(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
