import { log } from "@clack/prompts";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import type {
    CheckpointManifestEntry,
    CheckpointUpload,
    CreateSessionInput,
} from "@spire/types";

import {
    ManifestUnavailableError,
    SpireApiClient,
    SpireApiError,
} from "../api/client.js";
import {
    getHeartbeatIntervalMs,
    getWatcherTiming,
    MAX_FILE_BYTES,
    toPosixPath,
} from "../config.js";
import { validateCheckpointUpload } from "../diff/payload-validator.js";
import { buildFileSnapshot } from "../snapshot/build-snapshot.js";
import { buildRejoinCheckpoint } from "../snapshot/rejoin.js";
import { isBinaryContent } from "../watcher/binary.js";
import { CheckpointBatcher, type ChangeKind } from "../watcher/checkpoint-batcher.js";
import { FileWatcher } from "../watcher/fs-watcher.js";
import { createPathFilter, isStubDir } from "../watcher/gitignore-filter.js";
import { hashRegistryFromSnapshot, HashRegistry } from "../watcher/hash-registry.js";
import { generateSessionId } from "./id.js";
import { readSessionForDir, writeSessionForDir } from "./local-session.js";
import { consumeStopSentinel } from "./stop-sentinel.js";

/** Max number of changed files read and hashed in parallel during one flush. */
const CHECKPOINT_READ_CONCURRENCY = 16;

/** How often a running broadcast checks for a `spire stop` sentinel. */
const STOP_POLL_MS = 2000;

export type BuildEntryDeps = {
    rootResolved: string;
    pathFilter: { accepts: (absolutePath: string) => boolean };
    hashes: HashRegistry;
};

export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Converts a single file-watcher event into a checkpoint manifest entry. The
 * CLI sends only the new content and its SHA-256 hash; the server resolves the
 * prior version and computes diff stats. No file content is retained in memory
 * between checkpoints — only the per-file hash for change detection.
 *
 * Accepting explicit deps rather than closing over them makes this function
 * testable in isolation without a running watcher or real filesystem state.
 */
export async function buildEntry(
    absolutePath: string,
    kind: ChangeKind,
    deps: BuildEntryDeps
): Promise<CheckpointManifestEntry | null> {
    const { rootResolved, pathFilter, hashes } = deps;
    const relativePath = toPosixPath(path.relative(rootResolved, absolutePath));

    if (kind === "deleted") {
        if (!hashes.get(absolutePath)) {
            return null;
        }
        hashes.remove(absolutePath);
        return { path: relativePath, changeType: "deleted", hash: null, size: 0 };
    }

    if (!pathFilter.accepts(absolutePath)) {
        return null;
    }

    const stats = await stat(absolutePath).catch(() => null);
    if (!stats || !stats.isFile()) {
        if (!hashes.get(absolutePath)) {
            return null;
        }
        hashes.remove(absolutePath);
        return { path: relativePath, changeType: "deleted", hash: null, size: 0 };
    }

    if (stats.size > MAX_FILE_BYTES) {
        log.warn(
            `Skipped ${relativePath}: exceeds ${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB limit.`
        );
        return null;
    }

    const buffer = await readFile(absolutePath);
    const changeType = kind === "added" ? "added" : "modified";

    if (isBinaryContent(buffer)) {
        const hash = HashRegistry.fromBuffer(buffer);
        if (!hashes.hasChanged(absolutePath, hash)) {
            return null;
        }
        hashes.set(absolutePath, hash);
        return {
            path: relativePath,
            changeType,
            hash,
            size: buffer.byteLength,
            binary: true,
        };
    }

    const content = buffer.toString("utf8");
    const hash = HashRegistry.fromContent(content);
    if (!hashes.hasChanged(absolutePath, hash)) {
        return null;
    }
    hashes.set(absolutePath, hash);
    return {
        path: relativePath,
        changeType,
        hash,
        size: buffer.byteLength,
        content,
    };
}

/**
 * Runs `fn` over `items` with at most `limit` concurrent executions, preserving
 * input order in the result. Used to read and hash a burst of changed files in
 * parallel — bounded so a large branch switch or save-all can't exhaust file
 * descriptors — instead of awaiting them one at a time.
 */
async function mapLimit<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;
    const runWorker = async () => {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await fn(items[index]!);
        }
    };
    const workerCount = Math.max(1, Math.min(limit, items.length));
    await Promise.all(Array.from({ length: workerCount }, runWorker));
    return results;
}

export type CreateBroadcastOptions = {
    client: SpireApiClient;
    apiBaseUrl: string;
    /** Directory to broadcast (resolved to an absolute path internally). */
    rootDir: string;
    title?: string;
    /** Explicit session ID (single-project mode only). */
    session?: string;
    /** Links this session to sibling sessions started from the same workspace. */
    groupId?: string;
    /** Prefix for log lines, e.g. "backend" renders "[backend] Synced ...". */
    logPrefix?: string;
    buildSnapshot?: typeof buildFileSnapshot;
    /** Called after the broadcast stops itself in response to a stop sentinel. */
    onSelfStop?: (handle: BroadcastHandle) => void;
};

export type BroadcastHandle = {
    sessionId: string;
    shareUrl: string;
    rootDir: string;
    title: string;
    rejoined: boolean;
    /** Uploads the initial state and begins watching. */
    start: () => Promise<void>;
    /** Gracefully flushes, ends the session, and tears down. Idempotent. */
    stop: () => Promise<void>;
    /** Fire-and-forget session end for the crash path; no flush. */
    endImmediately: () => Promise<void>;
    stats: () => { checkpointsSynced: number };
};

/**
 * Creates one project's broadcast pipeline — snapshot/rejoin upload, change
 * batching, file watching, heartbeat, and stop-sentinel polling — as a
 * self-contained unit. Multiple broadcasts run concurrently in a single process
 * for multi-project sessions, each with its own session ID and log prefix; the
 * orchestrator owns process-wide concerns (Ctrl+C, crash handlers).
 */
export async function createBroadcast(
    opts: CreateBroadcastOptions
): Promise<BroadcastHandle> {
    const { client, apiBaseUrl } = opts;
    const rootResolved = path.resolve(opts.rootDir);
    const saved = await readSessionForDir(rootResolved);
    const rejoined = !opts.session && saved !== null;
    const sessionId = opts.session ?? saved?.sessionId ?? generateSessionId();
    const title =
        opts.title?.trim() || saved?.title || `Session ${new Date().toISOString()}`;
    const startedAt = saved?.startedAt ?? new Date().toISOString();
    const shareUrl = `${apiBaseUrl}/session/${sessionId}`;
    const doSnapshot = opts.buildSnapshot ?? buildFileSnapshot;

    const prefix = opts.logPrefix ? `[${opts.logPrefix}] ` : "";
    const line = {
        info: (msg: string) => log.info(`${prefix}${msg}`),
        success: (msg: string) => log.success(`${prefix}${msg}`),
        warn: (msg: string) => log.warn(`${prefix}${msg}`),
        error: (msg: string) => log.error(`${prefix}${msg}`),
        message: (msg: string) => log.message(`${prefix}${msg}`),
    };

    let checkpointsSynced = 0;
    let stopped = false;
    let watcher: FileWatcher | null = null;
    let batcher: CheckpointBatcher | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let stopPoll: ReturnType<typeof setInterval> | null = null;

    let lastRegistryWrite = 0;
    const persistRegistry = async (live = true) => {
        await writeSessionForDir({
            sessionId,
            title,
            rootDir: rootResolved,
            startedAt,
            apiBaseUrl,
            checkpointsSynced,
            // Omit liveness fields when stopping so `spire list` reports the
            // session as dead even if the parent process keeps running other
            // pipelines (multi-project mode).
            ...(live ? { pid: process.pid, lastSeenAt: new Date().toISOString() } : {}),
        });
        lastRegistryWrite = Date.now();
    };
    const maybePersistRegistry = () => {
        if (Date.now() - lastRegistryWrite > 5000) {
            void persistRegistry();
        }
    };

    const handle: BroadcastHandle = {
        sessionId,
        shareUrl,
        rootDir: rootResolved,
        title,
        rejoined,
        start,
        stop,
        endImmediately,
        stats: () => ({ checkpointsSynced }),
    };

    async function start(): Promise<void> {
        const sessionInput: CreateSessionInput = {
            title,
            ...(opts.groupId ? { groupId: opts.groupId } : {}),
        };
        await client.ensureSession(sessionId, sessionInput);

        const pathFilter = await createPathFilter(rootResolved);
        const snapshot = await doSnapshot(sessionId, rootResolved, (absolutePath) =>
            pathFilter.accepts(absolutePath)
        );

        if (rejoined) {
            try {
                const manifest = await client.getManifest(sessionId);
                const diff = buildRejoinCheckpoint(sessionId, manifest, snapshot);
                if (!diff) {
                    line.success(`Rejoined ${sessionId} — already in sync.`);
                } else {
                    await client.pushCheckpoint(sessionId, diff);
                    const count = diff.entries.length;
                    line.success(
                        `Rejoined ${sessionId} — synced ${count} changed file${count === 1 ? "" : "s"}.`
                    );
                }
            } catch (error) {
                if (error instanceof ManifestUnavailableError) {
                    await client.uploadSnapshot(sessionId, snapshot);
                    line.success(`Rejoined ${sessionId} — snapshot re-uploaded.`);
                } else {
                    throw error;
                }
            }
        } else {
            await client.uploadSnapshot(sessionId, snapshot);
            line.success(`Started ${sessionId}.`);
        }

        const hashes = hashRegistryFromSnapshot(rootResolved, snapshot.tree);
        await persistRegistry();
        line.info(`Watch ${rootResolved}`);
        line.info(`Share: ${shareUrl}`);

        const entryDeps: BuildEntryDeps = { rootResolved, pathFilter, hashes };
        const timing = getWatcherTiming();

        let warnedUploadFailure = false;
        batcher = new CheckpointBatcher({
            idleMs: timing.idleMs,
            maxWaitMs: timing.maxWaitMs,
            onFlush: async (changes) => {
                const priorHashes = new Map<string, string | undefined>();
                for (const absolutePath of changes.keys()) {
                    priorHashes.set(absolutePath, hashes.get(absolutePath));
                }

                const built = await mapLimit(
                    [...changes],
                    CHECKPOINT_READ_CONCURRENCY,
                    async ([absolutePath, kind]) => {
                        try {
                            return await buildEntry(absolutePath, kind, entryDeps);
                        } catch (error) {
                            line.warn(
                                `Failed to read ${toPosixPath(path.relative(rootResolved, absolutePath))}: ${errorMessage(error)}`
                            );
                            return null;
                        }
                    }
                );
                const entries = built.filter(
                    (entry): entry is CheckpointManifestEntry => entry !== null
                );
                if (entries.length === 0) {
                    return;
                }

                const upload: CheckpointUpload = {
                    sessionId,
                    entries,
                    timestamp: Date.now(),
                };
                const validation = validateCheckpointUpload(upload);
                if (!validation.ok) {
                    line.warn(`Skipped checkpoint: ${validation.reason}`);
                    return;
                }

                try {
                    await client.pushCheckpoint(sessionId, upload);
                } catch (error) {
                    // A concrete client error (4xx other than 429) will not succeed
                    // on retry; drop it loudly. Everything else is transient — roll
                    // back the hash registry and requeue so edits sync once the
                    // server returns rather than being silently lost.
                    const permanent =
                        error instanceof SpireApiError &&
                        error.status >= 400 &&
                        error.status < 500 &&
                        error.status !== 429;
                    if (permanent) {
                        line.error(`Checkpoint rejected by server: ${errorMessage(error)}`);
                        return;
                    }
                    for (const [absolutePath, priorHash] of priorHashes) {
                        if (priorHash === undefined) {
                            hashes.remove(absolutePath);
                        } else {
                            hashes.set(absolutePath, priorHash);
                        }
                    }
                    batcher?.requeue(changes);
                    if (!warnedUploadFailure) {
                        warnedUploadFailure = true;
                        line.warn(
                            `Could not reach the server — buffering changes and retrying (${errorMessage(error)}).`
                        );
                    }
                    return;
                }

                if (warnedUploadFailure) {
                    warnedUploadFailure = false;
                    line.success("Reconnected to the server.");
                }
                checkpointsSynced += 1;
                maybePersistRegistry();
                const summary =
                    entries.length === 1 ? entries[0]!.path : `${entries.length} files`;
                line.message(`Synced checkpoint #${checkpointsSynced} (${summary})`);
            },
        });

        const activeBatcher = batcher;
        watcher = new FileWatcher({
            rootDir: rootResolved,
            stabilityMs: timing.stabilityMs,
            ignored: (absolutePath) => {
                if (absolutePath === rootResolved) {
                    return false;
                }
                if (isStubDir(absolutePath)) {
                    return true;
                }
                return !pathFilter.accepts(absolutePath);
            },
            onEvent: (absolutePath, kind) => activeBatcher.add(absolutePath, kind),
            onError: (error) => line.error(`Watcher error: ${errorMessage(error)}`),
        });
        watcher.start();

        let heartbeatFailures = 0;
        let warnedHeartbeat = false;
        heartbeat = setInterval(() => {
            void (async () => {
                try {
                    await client.heartbeat(sessionId);
                    if (warnedHeartbeat) {
                        line.success("Heartbeat restored — session is live again.");
                    }
                    heartbeatFailures = 0;
                    warnedHeartbeat = false;
                    maybePersistRegistry();
                } catch (error) {
                    if (
                        error instanceof SpireApiError &&
                        (error.status === 404 || error.status === 409)
                    ) {
                        try {
                            await client.ensureSession(sessionId, sessionInput);
                            line.info(`Session ${sessionId} was reactivated.`);
                            heartbeatFailures = 0;
                            warnedHeartbeat = false;
                        } catch {
                            heartbeatFailures += 1;
                        }
                        return;
                    }
                    heartbeatFailures += 1;
                    if (heartbeatFailures >= 3 && !warnedHeartbeat) {
                        warnedHeartbeat = true;
                        line.warn(
                            "Server unreachable — viewers may see this session as ended."
                        );
                    }
                }
            })();
        }, getHeartbeatIntervalMs());
        heartbeat.unref();

        // Poll for a `spire stop` sentinel targeting this session.
        stopPoll = setInterval(() => {
            void (async () => {
                if (await consumeStopSentinel(sessionId)) {
                    await stop();
                    opts.onSelfStop?.(handle);
                }
            })();
        }, STOP_POLL_MS);
        stopPoll.unref();
    }

    async function stop(): Promise<void> {
        if (stopped) {
            return;
        }
        stopped = true;

        if (heartbeat) clearInterval(heartbeat);
        if (stopPoll) clearInterval(stopPoll);

        if (watcher) {
            await watcher.stop();
        }
        if (batcher) {
            // Flush any in-flight edits so files saved just before shutdown are
            // captured in the final checkpoint and not silently dropped.
            await batcher.flushNow();
            batcher.stop();
        }
        await persistRegistry(false).catch(() => {});

        try {
            await client.endSession(sessionId);
            line.success(`Session ${sessionId} stopped.`);
        } catch (error) {
            line.warn(
                `Could not reach the server to end ${sessionId} (${errorMessage(error)}). The share URL still resumes on next start.`
            );
        }
    }

    async function endImmediately(): Promise<void> {
        stopped = true;
        if (heartbeat) clearInterval(heartbeat);
        if (stopPoll) clearInterval(stopPoll);
        await client.endSession(sessionId).catch(() => {});
    }

    return handle;
}
