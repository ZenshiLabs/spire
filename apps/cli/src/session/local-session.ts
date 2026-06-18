import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getSessionsRegistryPath, getSpireDataDir } from "../config.js";

export type SessionRecord = {
    sessionId: string;
    title: string;
    rootDir: string;
    startedAt: string;
    apiBaseUrl: string;
    checkpointsSynced: number;
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

async function writeRegistry(registry: SessionRegistry): Promise<void> {
    await mkdir(getSpireDataDir(), { recursive: true });
    await writeFile(getSessionsRegistryPath(), JSON.stringify(registry, null, 2), "utf8");
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

export async function writeSessionForDir(record: SessionRecord): Promise<void> {
    const registry = await readRegistry();
    registry[normalizeDir(record.rootDir)] = record;
    await writeRegistry(registry);
}
