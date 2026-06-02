import { log } from "@clack/prompts";

import { SpireApiClient } from "../api/client.js";
import { readValidToken } from "../auth/token-store.js";
import { clearActiveSession, readActiveSession } from "../session/local-session.js";
import type { CommandModule } from "./types.js";

export async function runStopCommand(apiBaseUrl: string) {
    const activeSession = await readActiveSession();

    if (!activeSession) {
        log.warn("No active session found.");
        return;
    }

    const token = await readValidToken();
    if (!token) {
        throw new Error("Missing or expired login token. Run: spire login");
    }

    const client = new SpireApiClient(apiBaseUrl);
    await client.endSession(activeSession.sessionId, token.accessToken);
    await clearActiveSession();

    log.success(`Session ${activeSession.sessionId} ended.`);
}

const command: CommandModule = {
    name: "stop",
    hint: "Stop active session",
    run: async ({ apiBaseUrl }) => {
        await runStopCommand(apiBaseUrl);
    },
};

export default command;
