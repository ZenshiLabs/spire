import { Effect } from "effect";
import { RedisService } from "@spire/redis";

export const cacheGet = <T>(key: string): Effect.Effect<T | null, never, RedisService> =>
    Effect.gen(function* () {
        const redis = yield* RedisService;
        const raw = yield* redis.get(key).pipe(Effect.orElseSucceed(() => null));
        if (!raw) return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    });

export const cacheSet = (
    key: string,
    value: unknown,
    ttlSeconds: number
): Effect.Effect<void, never, RedisService> =>
    Effect.gen(function* () {
        const redis = yield* RedisService;
        yield* redis
            .set(key, JSON.stringify(value), ttlSeconds)
            .pipe(Effect.catchAll(() => Effect.void));
    });

export const cacheDel = (key: string): Effect.Effect<void, never, RedisService> =>
    Effect.gen(function* () {
        const redis = yield* RedisService;
        yield* redis.del(key).pipe(Effect.catchAll(() => Effect.void));
    });

export const nextSeq = (
    sessionId: string,
    seedMax: () => Promise<number>
): Effect.Effect<number | null, never, RedisService> =>
    Effect.gen(function* () {
        const redis = yield* RedisService;
        const key = `spire:seq:${sessionId}`;
        const exists = yield* redis.exists(key).pipe(Effect.orElseSucceed(() => false));
        if (!exists) {
            const max = yield* Effect.promise(async () => {
                try {
                    return await seedMax();
                } catch {
                    return -1;
                }
            });
            yield* redis.setNx(key, String(max)).pipe(Effect.catchAll(() => Effect.void));
        }
        return yield* redis.incr(key).pipe(
            Effect.map((n): number | null => n),
            Effect.orElseSucceed((): number | null => null)
        );
    }).pipe(Effect.catchAll(() => Effect.succeed<number | null>(null)));
