import { homedir } from "node:os";
import path from "node:path";

export type RuntimeEnv = Record<string, string | undefined>;

type RuntimeProcess = {
    env?: RuntimeEnv;
};

function getRuntimeProcess(): RuntimeProcess {
    const runtime = globalThis as { process?: RuntimeProcess };
    return runtime.process ?? {};
}

export function getRuntimeEnv(): RuntimeEnv {
    return getRuntimeProcess().env ?? {};
}

export function getApiBaseUrl(env: RuntimeEnv = getRuntimeEnv()): string {
    return env.SPIRE_API_URL ?? env.API_BASE_URL ?? "http://localhost:3000";
}

export type WatcherTiming = {
    /** Idle gap after the last change before a checkpoint is flushed. */
    idleMs: number;
    /** Hard cap on how long a sustained edit burst can delay a flush. */
    maxWaitMs: number;
    /** How long a file's size must hold steady before it's read (partial-write guard). */
    stabilityMs: number;
};

function positiveIntEnv(value: string | undefined, fallback: number): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Timing knobs that dominate the end-to-end latency between a save and a viewer
 * seeing the change. Defaults are tuned for a near-live feel; each can be raised
 * per-environment — e.g. on a slow disk or a noisy filesystem that reports
 * partial writes — without a rebuild. Lower values trade a little safety margin
 * for snappier updates; the content hash makes the rare partial read self-heal
 * on the next save.
 */
export function getWatcherTiming(env: RuntimeEnv = getRuntimeEnv()): WatcherTiming {
    return {
        idleMs: positiveIntEnv(env.SPIRE_IDLE_MS, 120),
        maxWaitMs: positiveIntEnv(env.SPIRE_MAX_WAIT_MS, 1000),
        stabilityMs: positiveIntEnv(env.SPIRE_STABILITY_MS, 75),
    };
}

/**
 * How often the CLI pings the server to report the broadcast is still live.
 * Must stay comfortably below the server's staleness window so a single dropped
 * heartbeat never makes a live session look ended. Configurable for slow links.
 */
export function getHeartbeatIntervalMs(env: RuntimeEnv = getRuntimeEnv()): number {
    return positiveIntEnv(env.SPIRE_HEARTBEAT_MS, 10_000);
}

export function getSpireDataDir(): string {
    return path.join(homedir(), ".spire");
}

/**
 * Absolute path to the JSON file that maps broadcast directories to their
 * session records. This is what makes a directory's session ID sticky — reading
 * this file on startup lets `spire start` rejoin the same URL instead of
 * generating a new session.
 */
export function getSessionsRegistryPath(): string {
    return path.join(getSpireDataDir(), "sessions.json");
}

export function toPosixPath(filePath: string): string {
    return filePath.replaceAll("\\", "/");
}

/**
 * Maximum number of bytes read into memory for a single file. Files exceeding
 * this limit are listed in the tree as non-renderable stubs so that a stray
 * multi-gigabyte binary can never exhaust the watcher's memory or produce an
 * unacceptably large upload payload.
 */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
