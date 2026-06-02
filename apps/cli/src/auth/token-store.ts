import { mkdir, readFile, rm, writeFile } from "node:fs/promises";

import { getCredentialsPath, getSpireDataDir } from "../config.js";

export type StoredToken = {
    accessToken: string;
    tokenType: "Bearer";
    expiresAt: number;
    refreshToken?: string;
};

async function setOwnerOnlyPermissions(filePath: string) {
    try {
        await import("node:fs/promises").then(({ chmod }) => chmod(filePath, 0o600));
    } catch {
        // chmod is best-effort on Windows and restricted filesystems.
    }
}

export async function readStoredToken(): Promise<StoredToken | null> {
    try {
        const content = await readFile(getCredentialsPath(), "utf8");
        const token = JSON.parse(content) as StoredToken;

        if (!token.accessToken || !token.expiresAt || token.tokenType !== "Bearer") {
            return null;
        }

        return token;
    } catch {
        return null;
    }
}

export async function writeStoredToken(token: StoredToken): Promise<void> {
    await mkdir(getSpireDataDir(), { recursive: true });
    const credentialsPath = getCredentialsPath();
    await writeFile(credentialsPath, JSON.stringify(token, null, 2), "utf8");
    await setOwnerOnlyPermissions(credentialsPath);
}

export async function clearStoredToken(): Promise<void> {
    await rm(getCredentialsPath(), { force: true });
}

export async function readValidToken(now = Date.now()): Promise<StoredToken | null> {
    const token = await readStoredToken();

    if (!token) {
        return null;
    }

    return token.expiresAt > now ? token : null;
}
