import { log } from "@clack/prompts";

import { SpireApiClient } from "../api/client.js";
import { readSessionForDir } from "../session/local-session.js";
import type { CommandModule } from "./types.js";

export async function runStopCommand(apiBaseUrl: string, rootDir: string) {
    const record = await readSessionForDir(rootDir);

    if (!record) {
        log.warn("No session found for this directory.");
        return;
    }

    const client = new SpireApiClient(apiBaseUrl);
    await client.endSession(record.sessionId);

    log.success(`Session ${record.sessionId} ended.`);
}

const command: CommandModule = {
    name: "stop",
    hint: "Stop this directory's session",
    run: async ({ apiBaseUrl, options }) => {
        await runStopCommand(apiBaseUrl, options.rootDir);
    },
};

export default command;
