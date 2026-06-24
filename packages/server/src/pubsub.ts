import { randomUUID } from "node:crypto";

import { RedisService } from "@spire/redis";
import type { SSEEvent } from "@spire/types";
import { Effect } from "effect";

import { EVENTS_CHANNEL } from "@spire/redis";

/**
 * Stable identifier for this server process. Stamped on every event we publish
 * to Redis so the subscriber on this same instance can skip the echo — we
 * already delivered locally before publishing to other instances.
 */
const instanceId = randomUUID();

const sessionSubscribers = new Map<string, Set<(event: SSEEvent) => void>>();

type BridgeMessage = { instanceId: string; sessionId: string; event: SSEEvent };

export function emitLocalEvent(sessionId: string, event: SSEEvent): void {
    const listeners = sessionSubscribers.get(sessionId);
    if (!listeners || listeners.size === 0) return;
    for (const listener of listeners) listener(event);
}

/**
 * Delivers an event to local SSE clients and publishes it to other instances.
 * Errors from Redis publish are logged and swallowed — local delivery always
 * happens first and is never gated on the Redis round-trip.
 */
export const broadcastSessionEvent = (
    sessionId: string,
    event: SSEEvent
): Effect.Effect<void, never, RedisService> =>
    Effect.gen(function* () {
        emitLocalEvent(sessionId, event);
        const redis = yield* RedisService;
        const msg: BridgeMessage = { instanceId, sessionId, event };
        yield* redis
            .publish(EVENTS_CHANNEL, JSON.stringify(msg))
            .pipe(Effect.catchAll(() => Effect.void));
    });

/**
 * Registers a per-session SSE listener and starts the Redis cross-instance
 * bridge on first call. Returns an unsubscribe function.
 */
export const subscribeToSession = (
    sessionId: string,
    listener: (event: SSEEvent) => void
): Effect.Effect<() => void, never, RedisService> =>
    Effect.gen(function* () {
        const redis = yield* RedisService;

        redis.ensureSubscriber((channel, rawPayload) => {
            try {
                const msg = JSON.parse(rawPayload) as BridgeMessage;
                // Skip messages published by this same process — they were
                // already delivered locally in broadcastSessionEvent.
                if (msg.instanceId === instanceId) return;
                emitLocalEvent(msg.sessionId, msg.event);
            } catch (err) {
                console.error("[pubsub] bad message", err);
            }
        });

        const existing =
            sessionSubscribers.get(sessionId) ?? new Set<(event: SSEEvent) => void>();
        existing.add(listener);
        sessionSubscribers.set(sessionId, existing);

        return () => {
            const listeners = sessionSubscribers.get(sessionId);
            if (!listeners) return;
            listeners.delete(listener);
            if (listeners.size === 0) sessionSubscribers.delete(sessionId);
        };
    });

export function buildConnectedEvent(sessionId: string): SSEEvent {
    return { type: "connected", sessionId, timestamp: Date.now() };
}
