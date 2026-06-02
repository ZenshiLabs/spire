import { z } from "zod/v4";

export const DeltaPayloadSchema = z.object({
    sessionId: z.string().uuid(),
    filePath: z.string().min(1),
    unifiedDiff: z.string(),
    hash: z.string().length(64), // SHA-256 hex
    timestamp: z.number().int().positive(),
    sequenceNum: z.number().int().nonnegative(),
});
export type DeltaPayload = z.infer<typeof DeltaPayloadSchema>;
