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
