import { log } from "@clack/prompts";

import { readStoredToken } from "../auth/token-store.js";
import { readActiveSession } from "../session/local-session.js";
import type { CommandModule } from "./types.js";

export async function runStatusCommand() {
    const token = await readStoredToken();
    const activeSession = await readActiveSession();

    if (!token) {
        log.warn("Not logged in. Run: spire login");
    } else {
        const expiresAt = new Date(token.expiresAt).toISOString();
        log.info(`Auth: logged in (expires ${expiresAt})`);
    }

    if (!activeSession) {
        log.warn("No active session.");
        return;
    }

    log.info(`Session: ${activeSession.sessionId}`);
    log.info(`Title: ${activeSession.title}`);
    log.info(`Root: ${activeSession.rootDir}`);
    log.info(`Deltas synced: ${activeSession.deltasSynced}`);
    log.info(`Started at: ${activeSession.startedAt}`);
}

const command: CommandModule = {
    name: "status",
    hint: "Show auth/session state",
    run: async () => {
        await runStatusCommand();
    },
};

export default command;
