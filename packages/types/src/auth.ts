import { z } from "zod/v4";

export const DeviceAuthRequestSchema = z.object({
    clientId: z.string().min(1),
    scope: z.string().default("session:write"),
});
export type DeviceAuthRequest = z.infer<typeof DeviceAuthRequestSchema>;

export const DeviceCodeResponseSchema = z.object({
    deviceCode: z.string(),
    userCode: z.string(),
    verificationUri: z.url(),
    expiresIn: z.number().int().positive(),
    interval: z.number().int().positive(),
});
export type DeviceCodeResponse = z.infer<typeof DeviceCodeResponseSchema>;

export const TokenResponseSchema = z.object({
    accessToken: z.string(),
    tokenType: z.literal("Bearer"),
    expiresIn: z.number().int().positive(),
    refreshToken: z.string().optional(),
});
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
