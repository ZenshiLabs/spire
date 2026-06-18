import { z } from "zod/v4";

export const SessionStatus = z.enum(["active", "ended"]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const CreateSessionSchema = z.object({
    title: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
});
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

export const SessionResponseSchema = z.object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string().nullable(),
    status: SessionStatus,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    endedAt: z.string().datetime().nullable(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
