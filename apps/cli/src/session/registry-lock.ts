import { mkdir, rmdir, stat } from "node:fs/promises";
import path from "node:path";

import { getSpireDataDir } from "../config.js";

/**
 * How long a lock directory may exist before it is considered abandoned by a
 * crashed process and forcibly removed. Registry writes take single-digit
 * milliseconds, so ten seconds is far beyond any legitimate hold time.
 */
const STALE_LOCK_MS = 10_000;

/** Total time a process will wait for the lock before giving up. */
const ACQUIRE_TIMEOUT_MS = 3_000;

function getLockDirPath(): string {
    return path.join(getSpireDataDir(), "sessions.lock");
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireLock(): Promise<void> {
    const lockDir = getLockDirPath();
    await mkdir(getSpireDataDir(), { recursive: true });
    const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;

    for (;;) {
        try {
            // mkdir without recursive is atomic: exactly one concurrent caller
            // succeeds, everyone else gets EEXIST.
            await mkdir(lockDir);
            return;
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code !== "EEXIST") {
                throw error;
            }
        }

        const info = await stat(lockDir).catch(() => null);
        if (info && Date.now() - info.mtimeMs > STALE_LOCK_MS) {
            // A crashed process left the lock behind. Remove it and retry;
            // if another waiter removes it first the rmdir fails harmlessly.
            await rmdir(lockDir).catch(() => {});
            continue;
        }

        if (Date.now() > deadline) {
            throw new Error(
                "Timed out waiting for the session registry lock. If no other spire process is running, delete ~/.spire/sessions.lock and retry."
            );
        }

        await sleep(50 + Math.random() * 50);
    }
}

/**
 * Serializes read-modify-write cycles on the session registry across
 * concurrently running CLI processes (e.g. `spire start` in two terminals).
 * Without this, both processes read the same registry, apply their own entry,
 * and the second write silently discards the first one's session record.
 */
export async function withRegistryLock<T>(fn: () => Promise<T>): Promise<T> {
    await acquireLock();
    try {
        return await fn();
    } finally {
        await rmdir(getLockDirPath()).catch(() => {});
    }
}
