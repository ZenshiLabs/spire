import { log, spinner } from "@clack/prompts";
import path from "node:path";

import { SpireApiClient } from "../api/client.js";
import type { buildFileSnapshot } from "../snapshot/build-snapshot.js";
import {
    type BroadcastHandle,
    createBroadcast,
    errorMessage,
} from "../session/broadcast.js";
import { loadWorkspace } from "../session/workspace.js";
import type { CommandModule } from "./types.js";

export type StartOptions = {
    apiBaseUrl: string;
    /** The directory the CLI was invoked from, for workspace resolution. */
    cwd: string;
    /** Absolute directories to broadcast (positional args + `--dir`). */
    dirs: string[];
    title?: string;
    session?: string;
    /** Injectable dependencies for testing. */
    _deps?: StartDeps;
};

export type StartDeps = {
    createClient?: (baseUrl: string) => SpireApiClient;
    buildSnapshot?: typeof buildFileSnapshot;
};

type ResolvedProject = {
    rootDir: string;
    title?: string;
    groupId?: string;
};

/**
 * Resolves which projects `spire start` should broadcast, in priority order:
 * explicit positional directories, then a `spire.json` workspace in the cwd,
 * then the cwd itself. Only a workspace links its sessions with a shared group
 * id; positional multi-dir sessions are independent.
 */
async function resolveProjects(options: StartOptions): Promise<ResolvedProject[]> {
    if (options.dirs.length > 0) {
        const single = options.dirs.length === 1;
        return options.dirs.map((rootDir) => ({
            rootDir,
            title: single && options.title ? options.title : path.basename(rootDir),
        }));
    }

    const workspace = await loadWorkspace(options.cwd);
    if (workspace) {
        return workspace.projects.map((project) => ({
            rootDir: project.rootDir,
            title: project.title ?? path.basename(project.rootDir),
            groupId: workspace.workspaceId,
        }));
    }

    return [{ rootDir: options.cwd, title: options.title }];
}

/**
 * Resolves when the user asks to stop broadcasting — a SIGINT (Ctrl+C), a
 * SIGTERM, or a raw Ctrl+C byte read from stdin.
 *
 * On Windows, @clack/prompts leaves stdin in raw mode after a spinner runs: its
 * internal `block()` intentionally skips restoring cooked mode on win32. A
 * raw-mode console delivers Ctrl+C as a literal ETX (0x03) byte rather than
 * raising SIGINT, so a SIGINT-only handler never fires and the CLI appears to
 * ignore Ctrl+C. We restore cooked mode so SIGINT works again, and also watch
 * stdin for a raw 0x03 as a fallback. Listeners are torn down on resolve so the
 * process can exit cleanly once shutdown finishes.
 */
function waitForShutdown(): Promise<void> {
    const { stdin } = process;

    if (stdin.isTTY && stdin.isRaw) {
        stdin.setRawMode(false);
    }

    return new Promise<void>((resolve) => {
        let settled = false;

        function finish() {
            if (settled) {
                return;
            }
            settled = true;
            process.removeListener("SIGINT", finish);
            process.removeListener("SIGTERM", finish);
            stdin.removeListener("data", onData);
            stdin.pause();
            resolve();
        }

        function onData(chunk: Buffer) {
            if (chunk.includes(0x03)) {
                finish();
            }
        }

        process.on("SIGINT", finish);
        process.on("SIGTERM", finish);
        stdin.on("data", onData);
        stdin.resume();
    });
}

export async function runStartCommand(options: StartOptions) {
    const projects = await resolveProjects(options);

    if (options.session && projects.length > 1) {
        throw new Error(
            "--session can only be used when broadcasting a single directory."
        );
    }

    const createClient =
        options._deps?.createClient ?? ((url) => new SpireApiClient(url));
    const client = createClient(options.apiBaseUrl);
    const multi = projects.length > 1;

    // Track which sessions are still running so a `spire stop --dir`/`--all`
    // sentinel that stops one pipeline can end the wait once the last one goes.
    const active = new Set<string>();
    let resolveAllStopped: () => void = () => {};
    const allStopped = new Promise<void>((resolve) => {
        resolveAllStopped = resolve;
    });
    const onSelfStop = (handle: BroadcastHandle) => {
        active.delete(handle.sessionId);
        if (active.size === 0) {
            resolveAllStopped();
        }
    };

    const handles: BroadcastHandle[] = [];
    for (const project of projects) {
        const handle = await createBroadcast({
            client,
            apiBaseUrl: options.apiBaseUrl,
            rootDir: project.rootDir,
            title: project.title,
            session: options.session,
            groupId: project.groupId,
            logPrefix: multi ? path.basename(project.rootDir) : undefined,
            buildSnapshot: options._deps?.buildSnapshot,
            onSelfStop,
        });
        handles.push(handle);
    }

    // Start pipelines sequentially — concurrent @clack spinners corrupt the
    // console on Windows, and initial snapshots take only seconds each.
    for (const handle of handles) {
        const spin = spinner();
        spin.start(
            handle.rejoined
                ? `Rejoining ${handle.title}…`
                : `Starting ${handle.title}…`
        );
        try {
            await handle.start();
            active.add(handle.sessionId);
            spin.stop(`${handle.title} → ${handle.shareUrl}`);
        } catch (error) {
            spin.stop(`Failed to start ${handle.title}: ${errorMessage(error)}`);
            // Roll back any pipelines already started before rethrowing.
            await Promise.allSettled(handles.map((h) => h.stop()));
            throw error;
        }
    }

    if (multi) {
        log.success(`Broadcasting ${handles.length} projects:`);
        for (const handle of handles) {
            log.info(`  ${handle.title}: ${handle.shareUrl}`);
        }
    }

    /**
     * Best-effort teardown of every session on a fatal error. Ctrl+C runs the
     * graceful path below; these handlers cover crashes so viewers are not left
     * watching a session that looks live but is dead. endSession is raced against
     * a short timeout so a hung network call cannot block process exit.
     */
    const handleFatal = (label: string) => (err: unknown) => {
        log.error(`${label}: ${errorMessage(err)}`);
        const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2000));
        void Promise.race([
            Promise.allSettled(handles.map((h) => h.endImmediately())),
            timeout,
        ]).finally(() => process.exit(1));
    };
    const onUncaughtException = handleFatal("Uncaught exception");
    const onUnhandledRejection = handleFatal("Unhandled rejection");
    process.on("uncaughtException", onUncaughtException);
    process.on("unhandledRejection", onUnhandledRejection);

    log.info("Watching for changes. Press Ctrl+C to stop.");

    try {
        await Promise.race([waitForShutdown(), allStopped]);
    } finally {
        process.removeListener("uncaughtException", onUncaughtException);
        process.removeListener("unhandledRejection", onUnhandledRejection);
        await Promise.allSettled(handles.map((handle) => handle.stop()));
    }
}

const command: CommandModule = {
    name: "start",
    hint: "Start broadcasting and watch files",
    run: async ({ apiBaseUrl, options }) => {
        await runStartCommand({
            apiBaseUrl,
            cwd: options.cwd,
            dirs: options.dirs,
            title: options.title,
            session: options.session,
        });
    },
};

export default command;
