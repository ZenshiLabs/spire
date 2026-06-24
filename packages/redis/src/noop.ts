import { Effect, Layer } from "effect";

import { RedisService, type RedisServiceShape } from "./service.js";

const noopShape: RedisServiceShape = {
    get: () => Effect.succeed(null),
    set: () => Effect.void,
    del: () => Effect.void,
    incr: () => Effect.succeed(0),
    exists: () => Effect.succeed(false),
    setNx: () => Effect.succeed(false),
    publish: () => Effect.void,
    ensureSubscriber: () => undefined,
};

/** Drop-in when `REDIS_URL` is unset — pure in-process mode, zero config. */
export const RedisServiceNoop: Layer.Layer<RedisService> =
    Layer.succeed(RedisService, noopShape);
