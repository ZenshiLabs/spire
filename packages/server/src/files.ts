import * as DB from "@spire/db";
import { RedisService } from "@spire/redis";
import { HASH_RE } from "@spire/types";
import { Effect } from "effect";

import { cacheGet, cacheSet } from "./cache.js";
import { fromDb } from "./db.js";
import { DbError } from "./errors.js";

const BLOB_CACHE_TTL = 60 * 60 * 24;

export const blobKey = (sessionId: string, hash: string) => `blob:${sessionId}:${hash}`;

export type CachedBlob = { content: string; binary: boolean };

/** Reads a blob through the shared cache, writing through on a miss. */
export const readBlobCached = (
    sessionId: string,
    hash: string
): Effect.Effect<CachedBlob | null, DbError, RedisService> =>
    Effect.gen(function* () {
        const key = blobKey(sessionId, hash);
        const cached = yield* cacheGet<CachedBlob>(key);
        if (cached) return cached;
        const blob = yield* fromDb("getBlob", () => DB.dbGetBlob(sessionId, hash));
        if (!blob) return null;
        const value: CachedBlob = { content: blob.content, binary: blob.binary };
        yield* cacheSet(key, value, BLOB_CACHE_TTL);
        return value;
    });

export const getFileContent = (
    sessionId: string,
    path: string,
    ref: string
): Effect.Effect<Awaited<ReturnType<typeof DB.dbGetFileContent>>, DbError, RedisService> =>
    Effect.gen(function* () {
        if (HASH_RE.test(ref)) {
            const key = blobKey(sessionId, ref);
            const cached = yield* cacheGet<CachedBlob>(key);
            if (cached) {
                return { content: cached.content, binary: cached.binary, hash: ref };
            }
        }
        const result = yield* fromDb("getFileContent", () =>
            DB.dbGetFileContent(sessionId, path, ref)
        );
        if (result) {
            yield* cacheSet(
                blobKey(sessionId, result.hash),
                { content: result.content, binary: result.binary } satisfies CachedBlob,
                BLOB_CACHE_TTL
            );
        }
        return result;
    });
