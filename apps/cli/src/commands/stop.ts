import { log } from "@clack/prompts";
import path from "node:path";

import { SpireApiClient } from "../api/client.js";
import {
    isSessionLive,
    readAllSessions,
    removeSessionForDir,
    type SessionRecord,
} from "../session/local-session.js";
import { clearStopSentinel, createStopSentinel } from "../session/stop-sentinel.js";
import type { CliOptions, CommandModule } from "./types.js";

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls the registry until the session's owning process is gone, or times out. */
async function waitUntilStopped(rootDir: string, timeoutMs = 10_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    const key = path.resolve(rootDir);
    while (Date.now() < deadline) {
        const record = (await readAllSessions()).find(
            (r) => path.resolve(r.rootDir) === key
        );
        if (!record || !isSessionLive(record)) {
            return true;
        }
        await sleep(500);
    }
    return false;
}

export async function runStopCommand(options: CliOptions) {
    const records = await readAllSessions();

    let targets: SessionRecord[];
    if (options.all) {
        targets = records;
    } else {
        const key = path.resolve(options.rootDir);
        targets = records.filter((record) => path.resolve(record.rootDir) === key);
    }

    if (targets.length === 0) {
        log.warn(
            options.all
                ? "No sessions to stop."
                : "No session found for this directory."
        );
        return;
    }

    for (const record of targets) {
        if (isSessionLive(record)) {
            // A live broadcast owns its watchers and network state; ask it to shut
            // down gracefully via a sentinel rather than killing it, so it flushes
            // the final checkpoint and ends the session itself.
            await createStopSentinel(record.sessionId);
            log.info(`Stopping ${record.title} (${record.sessionId})…`);
            const stopped = await waitUntilStopped(record.rootDir);
            if (stopped) {
                log.success(`Stopped ${record.title}.`);
            } else {
                log.warn(
                    `${record.title} did not confirm shutdown in time; it will stop on its next poll.`
                );
            }
        } else {
            // No live process: end the session directly and clean up local state.
            const client = new SpireApiClient(record.apiBaseUrl);
            await client.endSession(record.sessionId).catch(() => {});
            await clearStopSentinel(record.sessionId);
            await removeSessionForDir(record.rootDir);
            log.success(`Cleaned up ended session ${record.title}.`);
        }
    }
}

const command: CommandModule = {
    name: "stop",
    hint: "Stop a session (--dir <path> or --all)",
    run: async ({ options }) => {
        await runStopCommand(options);
    },
};

export default command;
