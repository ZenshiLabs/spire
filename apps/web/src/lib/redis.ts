import { randomUUID } from "node:crypto";

import Redis from "ioredis";
import type { SSEEvent } from "@spire/types";

/**
 * Server-only Redis layer. Everything here is **env-gated** on `REDIS_URL`:
 * when it is unset every export degrades to a no-op / null so the app runs
 * single-instance with the in-process pub/sub and no external broker, exactly
 * as it did before this module existed.
 *
 * Two roles need two connections:
 *  - `pub` — normal connection for PUBLISH / INCR / GET / SET (the cache + seq).
 *  - `sub` — a *dedicated* connection: once a Redis connection enters subscribe
 *    mode it can issue nothing but (un)subscribe, so it cannot be shared.
 *
 * `@upstash/redis` (HTTP REST) deliberately is not used: it can PUBLISH but a
 * long-lived SUBSCRIBE needs a held TCP connection, which `ioredis` provides
 * against Upstash's `rediss://` endpoint.
 */
const REDIS_URL = process.env.REDIS_URL;

/** Channel every instance publishes live session events to and subscribes from. */
const EVENTS_CHANNEL = "spire:events";

/**
 * Stable id for this process. Stamped on every published event so the
 * subscriber on the *originating* instance can skip its own messages — local
 * delivery already happened synchronously, so re-delivering the echo would
 * double-fire events for that instance's viewers.
 */
const instanceId = randomUUID();

export function isRedisEnabled(): boolean {
    return Boolean(REDIS_URL);
}

let pubClient: Redis | null = null;
let subClient: Redis | null = null;
let subscriberStarted = false;

/** Lazily opens (once) the shared publish/command connection, or null when off. */
function getPub(): Redis | null {
    if (!REDIS_URL) {
        return null;
    }
    if (!pubClient) {
        pubClient = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
        pubClient.on("error", (err) => {
            console.error("[redis:pub]", err);
        });
    }
    return pubClient;
}

type BridgeMessage = {
    instanceId: string;
    sessionId: string;
    event: SSEEvent;
};

/**
 * Starts the cross-instance subscriber exactly once. `deliverLocal` is the
 * in-process fan-out (`emitSessionEvent`) — messages from *other* instances are
 * replayed into it so their SSE viewers connected here receive the event. A
 * no-op when Redis is disabled or already started.
 */
export function ensureSubscriber(
    deliverLocal: (sessionId: string, event: SSEEvent) => void
): void {
    if (!REDIS_URL || subscriberStarted) {
        return;
    }
    subscriberStarted = true;

    const sub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    subClient = sub;
    sub.on("error", (err) => {
        console.error("[redis:sub]", err);
    });
    sub.on("message", (_channel, payload) => {
        try {
            const msg = JSON.parse(payload) as BridgeMessage;
            if (msg.instanceId === instanceId) {
                return; // our own event — already delivered locally
            }
            deliverLocal(msg.sessionId, msg.event);
        } catch (err) {
            console.error("[redis:sub] bad message", err);
        }
    });
    sub.subscribe(EVENTS_CHANNEL).catch((err) => {
        console.error("[redis:sub] subscribe failed", err);
        subscriberStarted = false;
    });
}

/**
 * Publishes a session event to every other instance. Fire-and-forget: local
 * delivery is the caller's responsibility and is never blocked on Redis.
 */
export function publishSessionEvent(sessionId: string, event: SSEEvent): void {
    const pub = getPub();
    if (!pub) {
        return;
    }
    const msg: BridgeMessage = { instanceId, sessionId, event };
    pub.publish(EVENTS_CHANNEL, JSON.stringify(msg)).catch((err) => {
        console.error("[redis:pub] publish failed", err);
    });
}

/**
 * Returns the next monotonic checkpoint seq using an atomic Redis `INCR`,
 * seeding the counter from the DB high-water mark on first use. Returns null
 * when Redis is off so the caller falls back to `dbGetMaxCheckpointSeq() + 1`.
 *
 * The unique `(sessionId, seq)` index remains the source of truth; this only
 * removes a per-checkpoint round-trip and the seq race the DB layer documents.
 * `seedMax` yields the DB max (or -1 for a fresh session), so the first INCR
 * after seeding returns max + 1.
 */
export async function nextCheckpointSeq(
    sessionId: string,
    seedMax: () => Promise<number>
): Promise<number | null> {
    const pub = getPub();
    if (!pub) {
        return null;
    }
    const key = `spire:seq:${sessionId}`;
    try {
        const exists = await pub.exists(key);
        if (!exists) {
            const max = await seedMax();
            // NX so a concurrent seeder cannot be clobbered between exists/set.
            await pub.set(key, String(max), "NX");
        }
        return await pub.incr(key);
    } catch (err) {
        console.error("[redis:seq]", err);
        return null;
    }
}

export async function cacheGetJSON<T>(key: string): Promise<T | null> {
    const pub = getPub();
    if (!pub) {
        return null;
    }
    try {
        const raw = await pub.get(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch (err) {
        console.error("[redis:get]", err);
        return null;
    }
}

export async function cacheSetJSON(
    key: string,
    value: unknown,
    ttlSeconds: number
): Promise<void> {
    const pub = getPub();
    if (!pub) {
        return;
    }
    try {
        await pub.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
        console.error("[redis:set]", err);
    }
}

export async function cacheDel(key: string): Promise<void> {
    const pub = getPub();
    if (!pub) {
        return;
    }
    try {
        await pub.del(key);
    } catch (err) {
        console.error("[redis:del]", err);
    }
}

/** Test/shutdown hook — closes any open connections. */
export async function closeRedis(): Promise<void> {
    await Promise.allSettled([pubClient?.quit(), subClient?.quit()]);
    pubClient = null;
    subClient = null;
    subscriberStarted = false;
}
