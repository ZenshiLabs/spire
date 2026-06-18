import { log } from "@clack/prompts";

import { readSessionForDir } from "../session/local-session.js";
import type { CommandModule } from "./types.js";

export async function runStatusCommand(rootDir: string) {
    const record = await readSessionForDir(rootDir);

    if (!record) {
        log.warn("No session found for this directory. Run: spire start");
        return;
    }

    log.info(`Session: ${record.sessionId}`);
    log.info(`Title: ${record.title}`);
    log.info(`Root: ${record.rootDir}`);
    log.info(`Share URL: ${record.apiBaseUrl}/session/${record.sessionId}`);
    log.info(`Checkpoints synced: ${record.checkpointsSynced}`);
    log.info(`Started at: ${record.startedAt}`);
}

const command: CommandModule = {
    name: "status",
    hint: "Show this directory's session",
    run: async ({ options }) => {
        await runStatusCommand(options.rootDir);
    },
};

export default command;
