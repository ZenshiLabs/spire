import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { and, asc, eq, gt, sql, type SQL } from "drizzle-orm";

import { getDb } from "../client.js";
import { compressBlob, decompressBlob } from "../compression.js";
import { blobs } from "../schema.js";

/**
 * One-off backfill: recompresses every blob still stored as raw UTF-8
 * (`compression = 'none'`) with brotli, matching what the write path now does.
 * Idempotent and forward-only — safe to re-run and to interrupt: rows already
 * converted to `'br'` no longer match the filter, and pagination advances by
 * primary key so nothing is processed twice.
 *
 * Run after applying migration 0003, from anywhere:
 *   pnpm --filter @spire/db build
 *   node packages/db/dist/scripts/compress-existing-blobs.js
 */

// DATABASE_URL lives in the web app's env files. Resolve them from this file's
// location (walking up to the workspace's apps/web) rather than the current
// working directory, so the script works no matter where node is invoked from.
function findWebEnvDir(): string | null {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 8; i++) {
        const candidate = resolve(dir, "apps/web");
        if (existsSync(candidate)) {
            return candidate;
        }
        const parent = dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    return null;
}

if (!process.env.DATABASE_URL) {
    const webEnvDir = findWebEnvDir();
    if (webEnvDir) {
        loadEnv({ path: resolve(webEnvDir, ".env.local") });
        loadEnv({ path: resolve(webEnvDir, ".env") });
    }
}

const PAGE = 200;
const UPDATE_CONCURRENCY = 20;

async function main(): Promise<void> {
    const db = getDb();
    let cursor: { sessionId: string; hash: string } | null = null;
    let scanned = 0;
    let compressed = 0;
    let rawBytes = 0;
    let storedBytes = 0;

    for (;;) {
        const conditions: SQL[] = [
            eq(blobs.compression, "none"),
            eq(blobs.binary, false),
            gt(blobs.size, 0),
        ];
        if (cursor) {
            conditions.push(
                sql`(${blobs.sessionId}, ${blobs.hash}) > (${cursor.sessionId}, ${cursor.hash})`
            );
        }

        const rows = await db
            .select({
                sessionId: blobs.sessionId,
                hash: blobs.hash,
                content: blobs.content,
            })
            .from(blobs)
            .where(and(...conditions))
            .orderBy(asc(blobs.sessionId), asc(blobs.hash))
            .limit(PAGE);

        if (rows.length === 0) {
            break;
        }
        cursor = {
            sessionId: rows[rows.length - 1]!.sessionId,
            hash: rows[rows.length - 1]!.hash,
        };
        scanned += rows.length;

        // Encode this page, keeping only rows that actually shrank.
        const updates: {
            sessionId: string;
            hash: string;
            data: Buffer;
        }[] = [];
        for (const row of rows) {
            const text = await decompressBlob(row.content, "none");
            const { data, compression } = await compressBlob(text);
            rawBytes += row.content.length;
            if (compression === "br") {
                storedBytes += data.length;
                updates.push({
                    sessionId: row.sessionId,
                    hash: row.hash,
                    data,
                });
            } else {
                storedBytes += row.content.length;
            }
        }

        for (let i = 0; i < updates.length; i += UPDATE_CONCURRENCY) {
            const batch = updates.slice(i, i + UPDATE_CONCURRENCY);
            await Promise.all(
                batch.map((u) =>
                    db
                        .update(blobs)
                        .set({ content: u.data, compression: "br" })
                        .where(
                            and(
                                eq(blobs.sessionId, u.sessionId),
                                eq(blobs.hash, u.hash)
                            )
                        )
                )
            );
        }
        compressed += updates.length;

        console.log(
            `scanned ${scanned}, compressed ${compressed} (last: ${cursor.sessionId}/${cursor.hash.slice(0, 8)})`
        );
    }

    const pct = rawBytes > 0 ? ((storedBytes / rawBytes) * 100).toFixed(1) : "0";
    console.log(
        `Done. Scanned ${scanned} blobs, compressed ${compressed}. ` +
            `Raw ${rawBytes} -> stored ${storedBytes} bytes (${pct}%).`
    );
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
