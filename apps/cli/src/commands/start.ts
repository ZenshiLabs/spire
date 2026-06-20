import { log, spinner } from "@clack/prompts";
import { randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import {
    type CheckpointManifestEntry,
    type CheckpointUpload,
    type CreateSessionInput,
} from "@spire/types";

import { SpireApiClient } from "../api/client.js";
import { getWatcherTiming, MAX_FILE_BYTES, toPosixPath } from "../config.js";
import { validateCheckpointUpload } from "../diff/payload-validator.js";
import { readSessionForDir, writeSessionForDir } from "../session/local-session.js";
import { buildFileSnapshot } from "../snapshot/build-snapshot.js";
import { isBinaryContent } from "../watcher/binary.js";
import {
    CheckpointBatcher,
    type ChangeKind,
} from "../watcher/checkpoint-batcher.js";
import { FileWatcher } from "../watcher/fs-watcher.js";
import { createPathFilter, isStubDir } from "../watcher/gitignore-filter.js";
import { hashRegistryFromSnapshot, HashRegistry } from "../watcher/hash-registry.js";
import type { CommandModule } from "./types.js";

export type StartOptions = {
    apiBaseUrl: string;
    rootDir: string;
    title?: string;
    session?: string;
    /**
     * Injectable dependencies for testing. In production all fields are
     * omitted and the real implementations are used.
     */
    _deps?: StartDeps;
};

export type StartDeps = {
    /** Override the API client constructor — inject an in-memory stub in tests. */
    createClient?: (baseUrl: string) => SpireApiClient;
    /** Override the snapshot builder — inject an in-memory version in tests. */
    buildSnapshot?: typeof buildFileSnapshot;
};

export type BuildEntryDeps = {
    rootResolved: string;
    pathFilter: { accepts: (absolutePath: string) => boolean };
    hashes: HashRegistry;
};

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
            /**
             * File was never tracked by the hash registry. This can happen when a
             * newly-created file is immediately deleted before the snapshot or a
             * previous checkpoint recorded it.
             */
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
        /**
         * The file vanished between the watcher event and the stat call. If it was
         * previously tracked, treat this as a deletion so the viewer stays in sync.
         */
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

/** Max number of changed files read and hashed in parallel during one flush. */
const CHECKPOINT_READ_CONCURRENCY = 16;

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

/**
 * Generates a URL-safe 8-character base36 session ID (e.g. "k3f9zq2a").
 * Uses `crypto.randomBytes` so each run produces a cryptographically unpredictable
 * token suitable for use as a shareable but unguessable session identifier.
 */
function generateSessionId(): string {
    return Array.from(randomBytes(8))
        .map((byte) => (byte % 36).toString(36))
        .join("");
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export async function runStartCommand(options: StartOptions) {
    const saved = await readSessionForDir(options.rootDir);
    const rejoined = !options.session && saved !== null;
    const sessionId = options.session ?? saved?.sessionId ?? generateSessionId();
    const title =
        options.title?.trim() || saved?.title || `Session ${new Date().toISOString()}`;
    const rootResolved = path.resolve(options.rootDir);

    const createClient = options._deps?.createClient ?? ((url) => new SpireApiClient(url));
    const doSnapshot = options._deps?.buildSnapshot ?? buildFileSnapshot;
    const client = createClient(options.apiBaseUrl);
    const sessionInput: CreateSessionInput = { title };
    const session = await client.ensureSession(sessionId, sessionInput);

    const pathFilter = await createPathFilter(options.rootDir);

    const snapshotSpinner = spinner();
    snapshotSpinner.start(
        rejoined
            ? "Rejoining session and re-uploading snapshot from local files..."
            : "Building and uploading initial snapshot..."
    );
    const snapshot = await doSnapshot(session.id, options.rootDir, (absolutePath) =>
        pathFilter.accepts(absolutePath)
    );
    await client.uploadSnapshot(session.id, snapshot);

    /**
     * Reuse the hashes computed during snapshot build to seed the change-detection
     * registry. This avoids a redundant second directory walk immediately after
     * the snapshot traversal already visited every file.
     */
    const hashes = hashRegistryFromSnapshot(rootResolved, snapshot.tree);
    snapshotSpinner.stop(rejoined ? "Snapshot re-uploaded." : "Initial snapshot uploaded.");

    let checkpointsSynced = 0;
    const startedAt = saved?.startedAt ?? new Date().toISOString();

    let lastRegistryWrite = 0;
    const persistRegistry = async () => {
        await writeSessionForDir({
            sessionId: session.id,
            title: session.title,
            rootDir: options.rootDir,
            startedAt,
            apiBaseUrl: options.apiBaseUrl,
            checkpointsSynced,
        });
        lastRegistryWrite = Date.now();
    };

    /**
     * Throttles registry writes to at most once every five seconds. A busy session
     * can produce dozens of checkpoints per minute, and the on-disk registry does
     * not need to be perfectly current between saves — it is only read at startup.
     */
    const maybePersistRegistry = () => {
        if (Date.now() - lastRegistryWrite > 5000) {
            void persistRegistry();
        }
    };

    await persistRegistry();

    const shareUrl = `${options.apiBaseUrl}/session/${session.id}`;
    log.success(`${rejoined ? "Rejoined" : "Started"} session: ${session.id}`);
    log.info(`Share this URL with viewers: ${shareUrl}`);
    log.info("Watching for changes. Press Ctrl+C to stop.");

    const entryDeps: BuildEntryDeps = { rootResolved, pathFilter, hashes };
    const timing = getWatcherTiming();

    const batcher = new CheckpointBatcher({
        idleMs: timing.idleMs,
        maxWaitMs: timing.maxWaitMs,
        onFlush: async (changes) => {
            const built = await mapLimit(
                [...changes],
                CHECKPOINT_READ_CONCURRENCY,
                async ([absolutePath, kind]) => {
                    try {
                        return await buildEntry(absolutePath, kind, entryDeps);
                    } catch (error) {
                        log.warn(
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
                sessionId: session.id,
                entries,
                timestamp: Date.now(),
            };

            const validation = validateCheckpointUpload(upload);
            if (!validation.ok) {
                log.warn(`Skipped checkpoint: ${validation.reason}`);
                return;
            }

            try {
                await client.pushCheckpoint(session.id, upload);
            } catch (error) {
                log.error(`Failed to sync checkpoint: ${errorMessage(error)}`);
                return;
            }

            checkpointsSynced += 1;
            maybePersistRegistry();
            const summary =
                entries.length === 1 ? entries[0]!.path : `${entries.length} files`;
            log.message(`Synced checkpoint #${checkpointsSynced} (${summary})`);
        },
    });

    const watcher = new FileWatcher({
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
        onEvent: (absolutePath, kind) => batcher.add(absolutePath, kind),
        onError: (error) => log.error(`Watcher error: ${errorMessage(error)}`),
    });

    watcher.start();

    await new Promise<void>((resolve) => {
        const runtime = globalThis as {
            process?: { on: (event: string, cb: () => void) => void };
        };
        const onSignal = () => resolve();
        runtime.process?.on("SIGINT", onSignal);
        runtime.process?.on("SIGTERM", onSignal);
    });

    /**
     * Flush any in-flight edits before tearing down so files saved in the moment
     * before Ctrl+C are captured in the final checkpoint and not silently dropped.
     */
    await watcher.stop();
    await batcher.flushNow();
    batcher.stop();
    await persistRegistry();

    try {
        await client.endSession(session.id);
        log.success(
            `Session ${session.id} stopped. Re-run "spire start" here to resume the same URL.`
        );
    } catch (error) {
        log.warn(
            `Could not reach the server to end the session (${errorMessage(error)}). The share URL still resumes on next start.`
        );
    }
}

const command: CommandModule = {
    name: "start",
    hint: "Start broadcasting and watch files",
    run: async ({ apiBaseUrl, options }) => {
        await runStartCommand({
            apiBaseUrl,
            rootDir: options.rootDir,
            title: options.title,
            session: options.session,
        });
    },
};

export default command;
