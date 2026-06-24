import { Redis } from "ioredis";
import { Effect, Layer } from "effect";

import { RedisError } from "./errors.js";
import { RedisService, type RedisServiceShape } from "./service.js";
import { EVENTS_CHANNEL } from "./constants.js";

function makeLive(url: string): RedisServiceShape {
    let pub: Redis | null = null;
    let sub: Redis | null = null;
    let subscriberStarted = false;

    const getPub = (): Redis => {
        if (!pub) {
            pub = new Redis(url, { maxRetriesPerRequest: 3 });
            pub.on("error", (err: unknown) => console.error("[redis:pub]", err));
        }
        return pub;
    };

    const wrap = <T>(operation: string, fn: () => Promise<T>): Effect.Effect<T, RedisError> =>
        Effect.tryPromise({ try: fn, catch: (cause) => new RedisError({ operation, cause }) });

    return {
        get: (key) =>
            wrap("get", () => getPub().get(key)),

        set: (key, value, ttlSeconds) =>
            wrap("set", () => getPub().set(key, value, "EX", ttlSeconds).then(() => undefined)),

        del: (key) =>
            wrap("del", () => getPub().del(key).then(() => undefined)),

        incr: (key) =>
            wrap("incr", () => getPub().incr(key)),

        exists: (key) =>
            wrap("exists", async () => (await getPub().exists(key)) > 0),

        setNx: (key, value) =>
            wrap("setNx", async () => (await getPub().set(key, value, "NX")) === "OK"),

        publish: (channel, message) =>
            wrap("publish", () => getPub().publish(channel, message).then(() => undefined)),

        ensureSubscriber: (onMessage) => {
            if (subscriberStarted) return;
            subscriberStarted = true;
            const client = new Redis(url, { maxRetriesPerRequest: null });
            sub = client;
            client.on("error", (err: unknown) => console.error("[redis:sub]", err));
            // Forward all messages to caller — the caller is responsible for
            // filtering its own published messages via an instanceId it stamps.
            client.on("message", (channel: string, rawPayload: string) => {
                onMessage(channel, rawPayload);
            });
            client.subscribe(EVENTS_CHANNEL).catch((err: unknown) => {
                console.error("[redis:sub] subscribe failed", err);
                subscriberStarted = false;
            });
        },
    };
}

export const RedisServiceLive = (url: string): Layer.Layer<RedisService> =>
    Layer.succeed(RedisService, makeLive(url));
