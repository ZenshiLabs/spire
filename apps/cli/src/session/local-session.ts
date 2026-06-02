import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { getActiveSessionPath, getSpireDataDir } from "../config.js";

export type ActiveSessionState = {
    sessionId: string;
    title: string;
    rootDir: string;
    startedAt: string;
    apiBaseUrl: string;
    deltasSynced: number;
};

export async function readActiveSession(): Promise<ActiveSessionState | null> {
    try {
        const content = await readFile(getActiveSessionPath(), "utf8");
        return JSON.parse(content) as ActiveSessionState;
    } catch {
        return null;
    }
}

export async function writeActiveSession(state: ActiveSessionState): Promise<void> {
    await mkdir(getSpireDataDir(), { recursive: true });
    await writeFile(getActiveSessionPath(), JSON.stringify(state, null, 2), "utf8");
}

export async function clearActiveSession(): Promise<void> {
    await rm(getActiveSessionPath(), { force: true });
}
