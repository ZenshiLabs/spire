import * as DB from "@spire/db";
import { RedisService } from "@spire/redis";
import type { CreateSessionInput, SessionResponse } from "@spire/types";
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

export const touchSession = (sessionId: string): Effect.Effect<boolean, DbError> =>
    Effect.gen(function* () {
        const session = yield* fromDb("getSession", () => DB.dbGetSession(sessionId));
        if (!session) return false;
        yield* fromDb("touchSession", () => DB.dbTouchSession(sessionId));
        return true;
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
