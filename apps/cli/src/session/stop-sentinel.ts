import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getSpireDataDir } from "../config.js";

function getControlDir(): string {
    return path.join(getSpireDataDir(), "control");
}

function getSentinelPath(sessionId: string): string {
    return path.join(getControlDir(), `${sessionId}.stop`);
}

/**
 * Signals a running broadcast for `sessionId` to shut down gracefully by
 * dropping a sentinel file it polls for. Used instead of an OS signal because on
 * Windows `process.kill(pid, "SIGTERM")` terminates the target without running
 * its shutdown handlers, which would skip the final checkpoint flush and the
 * endSession call.
 */
export async function createStopSentinel(sessionId: string): Promise<void> {
    await mkdir(getControlDir(), { recursive: true });
    await writeFile(getSentinelPath(sessionId), String(Date.now()), "utf8");
}

/**
 * Returns true and removes the sentinel if a stop has been requested for this
 * session, false otherwise. Polled by the running broadcast.
 */
export async function consumeStopSentinel(sessionId: string): Promise<boolean> {
    const sentinel = getSentinelPath(sessionId);
    try {
        await access(sentinel);
    } catch {
        return false;
    }
    await rm(sentinel, { force: true }).catch(() => {});
    return true;
}

/** Removes a session's sentinel if present. Used to tidy up after a dead session. */
export async function clearStopSentinel(sessionId: string): Promise<void> {
    await rm(getSentinelPath(sessionId), { force: true }).catch(() => {});
}
