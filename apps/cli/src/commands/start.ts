import { log, spinner } from "@clack/prompts";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { type CreateSessionInput } from "@spire/types";

import { SpireApiClient } from "../api/client.js";
import { toPosixPath } from "../config.js";
import { readValidToken } from "../auth/token-store.js";
import { buildUnifiedDiff } from "../diff/diff-engine.js";
import { validateDeltaPayload } from "../diff/payload-validator.js";
import { clearActiveSession, writeActiveSession } from "../session/local-session.js";
import { FsWatcher } from "../watcher/fs-watcher.js";
import { createPathFilter } from "../watcher/gitignore-filter.js";
import { buildInitialHashes, HashRegistry } from "../watcher/hash-registry.js";
import type { CommandModule } from "./types.js";

export type StartOptions = {
    apiBaseUrl: string;
    rootDir: string;
    title?: string;
};

export async function runStartCommand(options: StartOptions) {
    const token = await readValidToken();
    if (!token) {
        throw new Error("Missing or expired login token. Run: spire login");
    }

    const title = options.title?.trim() || `Session ${new Date().toISOString()}`;
    const createSessionInput: CreateSessionInput = {
        title,
        maxViewers: 50,
    };

    const client = new SpireApiClient(options.apiBaseUrl);
    const session = await client.createSession(createSessionInput, token.accessToken);

    const pathFilter = await createPathFilter(options.rootDir);

    const setupSpinner = spinner();
    setupSpinner.start("Building initial file hash registry...");
    const hashes = await buildInitialHashes(options.rootDir, (absolutePath) => pathFilter.accepts(absolutePath));
    setupSpinner.stop("Initial file hash registry complete.");

    let sequenceNum = 0;
    let deltasSynced = 0;
    const startedAt = new Date().toISOString();

    await writeActiveSession({
        sessionId: session.id,
        title: session.title,
        rootDir: options.rootDir,
        startedAt,
        apiBaseUrl: options.apiBaseUrl,
        deltasSynced,
    });

    log.success(`Session started: ${session.id}`);
    log.info("Watching for changes. Press Ctrl+C to stop.");

    const watcher = new FsWatcher(
        {
            rootDir: options.rootDir,
            debounceMs: 300,
            onError: (error) => {
                const message = error instanceof Error ? error.message : String(error);
                log.error(`Watcher error: ${message}`);
            },
        },
        async (absolutePath) => {
            if (!pathFilter.accepts(absolutePath)) {
                return;
            }

            const isFile = await lstat(absolutePath)
                .then((statResult) => statResult.isFile())
                .catch(() => false);

            if (!isFile) {
                const relativePath = pathFilter.toRelativePath(absolutePath);
                hashes.remove(absolutePath);
                log.warn(`Skipped non-file change: ${relativePath}`);
                return;
            }

            const content = await readFile(absolutePath, "utf8");
            const nextHash = HashRegistry.fromContent(content);

            if (!hashes.hasChanged(absolutePath, nextHash)) {
                return;
            }

            const relativePath = toPosixPath(path.relative(options.rootDir, absolutePath));
            const unifiedDiff = buildUnifiedDiff(relativePath, "", content);

            const payload = {
                sessionId: session.id,
                filePath: relativePath,
                unifiedDiff,
                hash: nextHash,
                timestamp: Date.now(),
                sequenceNum,
            };

            const validation = validateDeltaPayload(payload);
            if (!validation.ok) {
                log.warn(`Skipped delta for ${relativePath}: ${validation.reason}`);
                return;
            }

            await client.pushDelta(token.accessToken, payload);
            hashes.set(absolutePath, nextHash);
            sequenceNum += 1;
            deltasSynced += 1;

            await writeActiveSession({
                sessionId: session.id,
                title: session.title,
                rootDir: options.rootDir,
                startedAt,
                apiBaseUrl: options.apiBaseUrl,
                deltasSynced,
            });

            log.message(`Synced delta #${sequenceNum} for ${relativePath}`);
        }
    );

    watcher.start();

    await new Promise<void>((resolve) => {
        const runtime = globalThis as { process?: { on: (event: string, cb: () => void) => void } };
        runtime.process?.on("SIGINT", () => {
            resolve();
        });
    });

    watcher.stop();

    try {
        await client.endSession(session.id, token.accessToken);
    } finally {
        await clearActiveSession();
    }

    log.success(`Session ${session.id} stopped.`);
}

const command: CommandModule = {
    name: "start",
    hint: "Start session and watch files",
    run: async ({ apiBaseUrl, options }) => {
        await runStartCommand({
            apiBaseUrl,
            rootDir: options.rootDir,
            title: options.title,
        });
    },
};

export default command;
