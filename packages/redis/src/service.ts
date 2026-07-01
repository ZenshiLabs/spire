import { Context } from "effect";
import type { Effect } from "effect";
import type { RedisError } from "./errors.js";

export interface RedisServiceShape {
    /**
     * Whether this is a real Redis connection (true) or the in-process noop
     * (false). Lets callers such as the rate limiter choose a cross-instance
     * strategy when Redis is present and an in-memory fallback when it is not.
     */
    readonly available: boolean;
    readonly get: (key: string) => Effect.Effect<string | null, RedisError>;
    readonly set: (key: string, value: string, ttlSeconds: number) => Effect.Effect<void, RedisError>;
    readonly del: (key: string) => Effect.Effect<void, RedisError>;
    readonly incr: (key: string) => Effect.Effect<number, RedisError>;
    readonly expire: (key: string, ttlSeconds: number) => Effect.Effect<void, RedisError>;
    readonly exists: (key: string) => Effect.Effect<boolean, RedisError>;
    readonly setNx: (key: string, value: string) => Effect.Effect<boolean, RedisError>;
    readonly publish: (channel: string, message: string) => Effect.Effect<void, RedisError>;
    /**
     * Starts the cross-instance subscriber exactly once. `onMessage` receives
     * raw payloads from OTHER instances only — same-instance messages are
     * filtered out internally using a stable per-process UUID.
     */
    readonly ensureSubscriber: (onMessage: (channel: string, message: string) => void) => void;
}

export class RedisService extends Context.Tag("@spire/redis/RedisService")<
    RedisService,
    RedisServiceShape
>() {}
