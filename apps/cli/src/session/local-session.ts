import { mkdir, rename, rm, writeFile, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

import { getSessionsRegistryPath, getSpireDataDir } from "../config.js";
import { withRegistryLock } from "./registry-lock.js";

export type SessionRecord = {
    sessionId: string;
    title: string;
    rootDir: string;
    startedAt: string;
    apiBaseUrl: string;
    checkpointsSynced: number;
    /**
     * OS process id of the CLI broadcasting this session. Used by `spire list`
     * and `spire stop` to tell live sessions from dead ones. Optional so
     * registries written by older CLI versions still parse.
     */
    pid?: number;
    /**
     * ISO timestamp of the last time the broadcasting process reported liveness.
     * Combined with `pid`, lets other commands detect a session whose process
     * died without cleaning up. Optional for backwards compatibility.
     */
    lastSeenAt?: string;
};

type SessionRegistry = Record<string, SessionRecord>;

function normalizeDir(rootDir: string): string {
    return path.resolve(rootDir);
}

async function readRegistry(): Promise<SessionRegistry> {
    try {
        const content = await readFile(getSessionsRegistryPath(), "utf8");
        return JSON.parse(content) as SessionRegistry;
    } catch {
        return {};
    }
}

/**
 * Atomically replaces the registry file. Serializing to a uniquely-named temp
 * file on the same volume and renaming it over the target means a concurrent
 * reader never observes a half-written file, and a crash mid-write leaves the
 * previous registry intact. Callers must already hold the registry lock.
 */
async function writeRegistry(registry: SessionRegistry): Promise<void> {
    await mkdir(getSpireDataDir(), { recursive: true });
    const target = getSessionsRegistryPath();
    const tmp = `${target}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
    try {
        await writeFile(tmp, JSON.stringify(registry, null, 2), "utf8");
        await rename(tmp, target);
    } catch (error) {
        await rm(tmp, { force: true }).catch(() => {});
        throw error;
    }
}

/**
 * Reads the session previously broadcast from this directory. This is what
 * makes a directory's share URL sticky across CLI restarts: re-running
 * `spire start` in the same folder resumes the same session ID rather than
 * creating a new one, so the share URL never changes for a given project.
 */
export async function readSessionForDir(rootDir: string): Promise<SessionRecord | null> {
    const registry = await readRegistry();
    return registry[normalizeDir(rootDir)] ?? null;
}

/** Returns every session record currently in the registry. */
export async function readAllSessions(): Promise<SessionRecord[]> {
    const registry = await readRegistry();
    return Object.values(registry);
}

export async function writeSessionForDir(record: SessionRecord): Promise<void> {
    await withRegistryLock(async () => {
        const registry = await readRegistry();
        registry[normalizeDir(record.rootDir)] = record;
        await writeRegistry(registry);
    });
}

/** How recent a record's heartbeat must be for its process to count as live. */
const LIVENESS_WINDOW_MS = 30_000;

/**
 * Reports whether the process that owns a session record is still broadcasting.
 * Requires both a living pid and a recent heartbeat: the pid guards against a
 * process that exited, and the timestamp guards against a stale record whose pid
 * has since been reused by an unrelated process.
 */
export function isSessionLive(record: SessionRecord): boolean {
    if (record.pid === undefined || !record.lastSeenAt) {
        return false;
    }
    try {
        // Signal 0 performs existence/permission checks without delivering a
        // signal. EPERM means the process exists but is owned by another user —
        // still alive for our purposes.
        process.kill(record.pid, 0);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EPERM") {
            return false;
        }
    }
    return Date.now() - new Date(record.lastSeenAt).getTime() < LIVENESS_WINDOW_MS;
}

/** Removes a directory's session record. No-op if none is present. */
export async function removeSessionForDir(rootDir: string): Promise<void> {
    await withRegistryLock(async () => {
        const registry = await readRegistry();
        const key = normalizeDir(rootDir);
        if (key in registry) {
            delete registry[key];
            await writeRegistry(registry);
        }
    });
}
