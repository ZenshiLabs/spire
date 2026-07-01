import * as DB from "@spire/db";
import { RedisService } from "@spire/redis";
import type { CreateSessionInput, SessionManifest, SessionResponse } from "@spire/types";
import { Effect } from "effect";

import { cacheDel, cacheGet, cacheSet } from "./cache.js";
import { fromDb } from "./db.js";
import { DbError } from "./errors.js";
import { broadcastSessionEvent } from "./pubsub.js";

export type EndSessionResult =
    | { ok: true; session: SessionResponse }
    | { ok: false; code: "not_found" | "already_ended" };

const SESSION_CACHE_TTL = 30;
const SESSION_STALE_MS = Number(process.env.SPIRE_SESSION_STALE_MS) || 45_000;

const sessionKey = (sessionId: string) => `sess:${sessionId}`;

function nowMs() {
    return Date.now();
}

function isStale(session: SessionResponse): boolean {
    return (
        session.status === "active" &&
        nowMs() - new Date(session.updatedAt).getTime() > SESSION_STALE_MS
    );
}

function withLiveness(session: SessionResponse): SessionResponse {
    if (!isStale(session)) return session;
    return { ...session, status: "ended", endedAt: session.updatedAt };
}

export const getSessionById = (
    sessionId: string
): Effect.Effect<SessionResponse | null, DbError, RedisService> =>
    Effect.gen(function* () {
        const key = sessionKey(sessionId);
        const cached = yield* cacheGet<SessionResponse>(key);
        if (cached) return withLiveness(cached);
        const session = yield* fromDb("getSession", () => DB.dbGetSession(sessionId));
        if (session) yield* cacheSet(key, session, SESSION_CACHE_TTL);
        return session ? withLiveness(session) : null;
    });

export const upsertSession = (
    sessionId: string,
    input: CreateSessionInput
): Effect.Effect<SessionResponse, DbError, RedisService> =>
    Effect.gen(function* () {
        const session = yield* fromDb("upsertSession", () => DB.dbUpsertSession(sessionId, input));
        yield* cacheDel(sessionKey(sessionId));
        return session;
    });

/**
 * Returns the session's current head-file manifest (path + hash + size + binary
 * per file, no content). The CLI diffs this against local state on rejoin to
 * upload only what changed instead of re-sending the whole snapshot. Returns
 * null when the session does not exist so the route can answer 404.
 */
export const getSessionManifest = (
    sessionId: string
): Effect.Effect<SessionManifest | null, DbError> =>
    Effect.gen(function* () {
        const session = yield* fromDb("getSession", () => DB.dbGetSession(sessionId));
        if (!session) return null;
        const headFiles = yield* fromDb("getFilesHead", () =>
            DB.dbGetFilesHead(sessionId)
        );
        return {
            files: headFiles.map((file) => ({
                path: file.path,
                hash: file.hash,
                size: file.size,
                binary: file.binary,
            })),
        };
    });

export type TouchSessionResult = "touched" | "not_found" | "ended";

export const touchSession = (
    sessionId: string
): Effect.Effect<TouchSessionResult, DbError> =>
    Effect.gen(function* () {
        const session = yield* fromDb("getSession", () => DB.dbGetSession(sessionId));
        if (!session) return "not_found";
        // Report an ended session distinctly so the CLI can reactivate it via
        // PUT rather than silently heartbeating a session viewers see as dead.
        if (session.status !== "active") return "ended";
        yield* fromDb("touchSession", () => DB.dbTouchSession(sessionId));
        return "touched";
    });

export type CleanupResult = { ended: number; deleted: number };

/**
 * Retention sweep for the cleanup cron: marks abandoned active sessions as ended
 * (their CLI died without a clean shutdown), then deletes ended sessions past
 * the retention window. FK cascades reclaim all child rows. `idleCutoff` and
 * `expiryCutoff` are absolute timestamps computed by the caller.
 */
export const cleanupSessions = (
    idleCutoff: Date,
    expiryCutoff: Date
): Effect.Effect<CleanupResult, DbError> =>
    Effect.gen(function* () {
        const ended = yield* fromDb("markAbandonedSessions", () =>
            DB.dbMarkAbandonedSessions(idleCutoff)
        );
        const deleted = yield* fromDb("deleteExpiredSessions", () =>
            DB.dbDeleteExpiredSessions(expiryCutoff)
        );
        return { ended, deleted };
    });

export const isSessionStale = (sessionId: string): Effect.Effect<boolean, DbError> =>
    fromDb("getSession", () => DB.dbGetSession(sessionId)).pipe(
        Effect.map((session) => (session ? isStale(session) : true))
    );

export const endSession = (
    sessionId: string
): Effect.Effect<EndSessionResult, DbError, RedisService> =>
    Effect.gen(function* () {
        const session = yield* fromDb("getSession", () => DB.dbGetSession(sessionId));
        if (!session) return { ok: false as const, code: "not_found" as const };
        if (session.status !== "active")
            return { ok: false as const, code: "already_ended" as const };

        const updated = yield* fromDb("endSession", () => DB.dbEndSession(sessionId));
        if (!updated) return { ok: false as const, code: "not_found" as const };

        yield* cacheDel(sessionKey(sessionId));
        yield* broadcastSessionEvent(sessionId, {
            type: "session_ended",
            sessionId,
            timestamp: nowMs(),
        });

        return { ok: true as const, session: updated };
    });
