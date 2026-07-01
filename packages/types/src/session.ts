import { z } from "zod/v4";

export const SessionStatus = z.enum(["active", "ended"]);
export type SessionStatus = z.infer<typeof SessionStatus>;

export const CreateSessionSchema = z.object({
    title: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
    /**
     * Optional workspace/group id linking sessions started together from one
     * `spire.json`. Additive and optional so older CLIs (which never send it) and
     * older servers (which strip it) stay compatible.
     */
    groupId: z.string().min(1).max(64).optional(),
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
    /**
     * Nullable and optional: null when a session has no group, absent when the
     * response comes from a server predating this field so a newer CLI parsing an
     * older server's response still validates.
     */
    groupId: z.string().nullable().optional(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

/**
 * A single current-head file entry as reported by the manifest endpoint.
 * Content is not included — only the identity a client needs to decide whether
 * its local copy differs from the server's.
 */
export const SessionManifestEntrySchema = z.object({
    path: z.string().min(1),
    hash: z.string().length(64),
    size: z.number().int().nonnegative(),
    binary: z.boolean(),
});
export type SessionManifestEntry = z.infer<typeof SessionManifestEntrySchema>;

/**
 * The server's view of every current file in a session, used by the CLI on
 * rejoin to diff local state against the server and upload only what changed
 * instead of re-sending the entire snapshot.
 */
export const SessionManifestSchema = z.object({
    files: z.array(SessionManifestEntrySchema),
});
export type SessionManifest = z.infer<typeof SessionManifestSchema>;
