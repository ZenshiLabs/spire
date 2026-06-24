import { Effect } from "effect";
import { type RedisService, RedisServiceLive, RedisServiceNoop } from "@spire/redis";

export const redisLayer = process.env.REDIS_URL
    ? RedisServiceLive(process.env.REDIS_URL)
    : RedisServiceNoop;

/** Run an Effect that requires Redis. Provides the layer and unwraps to a Promise. */
export const run = <A, E>(effect: Effect.Effect<A, E, RedisService>): Promise<A> =>
    Effect.runPromise(effect.pipe(Effect.provide(redisLayer)));
