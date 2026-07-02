import { Effect } from "effect";
import { RedisService } from "@spire/redis";

import type { RateLimitConfig } from "./limits";
import { run } from "./runtime";

type Window = { count: number; resetAt: number };

/**
 * Per-instance fallback store, used when Redis is not configured (single-box
 * self-hosts) or is momentarily unreachable. Keys are pruned lazily once the map
 * grows past a threshold so it cannot leak memory over a long-lived process.
 */
const memory = new Map<string, Window>();
const MEMORY_PRUNE_THRESHOLD = 10_000;

function pruneExpired(now: number): void {
    for (const [key, window] of memory) {
        if (window.resetAt <= now) {
            memory.delete(key);
        }
    }
}

function checkMemory(key: string, limit: number, windowSec: number): boolean {
    const now = Date.now();
    if (memory.size > MEMORY_PRUNE_THRESHOLD) {
        pruneExpired(now);
    }
    const existing = memory.get(key);
    if (!existing || existing.resetAt <= now) {
        memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
        return true;
    }
    existing.count += 1;
    return existing.count <= limit;
}

/**
 * Fixed-window rate check. Returns true when the request is within budget. Uses
 * an atomic Redis INCR (+EXPIRE on the first hit of a window) for cross-instance
 * accuracy when Redis is present, and an in-memory window otherwise or when a
 * Redis call fails.
 */
export const checkRateLimit = (
    key: string,
    limit: number,
    windowSec: number
): Effect.Effect<boolean, never, RedisService> =>
    Effect.gen(function* () {
        const redis = yield* RedisService;
        if (!redis.available) {
            return checkMemory(key, limit, windowSec);
        }
        const rlKey = `rl:${key}`;
        const count = yield* redis.incr(rlKey).pipe(Effect.orElseSucceed(() => -1));
        if (count < 0) {
            // Redis errored — degrade to the in-memory limiter rather than
            // failing open entirely.
            return checkMemory(key, limit, windowSec);
        }
        if (count === 1) {
            yield* redis.expire(rlKey, windowSec).pipe(Effect.catchAll(() => Effect.void));
        }
        return count <= limit;
    });

/** Promise wrapper for use directly in route handlers. */
export function rateLimit(key: string, config: RateLimitConfig): Promise<boolean> {
    return run(checkRateLimit(key, config.limit, config.windowSec));
}
