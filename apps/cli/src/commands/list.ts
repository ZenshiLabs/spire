import { log } from "@clack/prompts";

import { isSessionLive, readAllSessions } from "../session/local-session.js";
import type { CommandModule } from "./types.js";

export async function runListCommand() {
    const records = await readAllSessions();

    if (records.length === 0) {
        log.info("No sessions yet. Run: spire start");
        return;
    }

    const sorted = [...records].sort((a, b) => a.rootDir.localeCompare(b.rootDir));
    log.info(`${sorted.length} session${sorted.length === 1 ? "" : "s"}:`);
    for (const record of sorted) {
        const status = isSessionLive(record) ? "● live" : "○ dead";
        const url = `${record.apiBaseUrl}/session/${record.sessionId}`;
        log.message(`${status}  ${record.title}\n        ${record.rootDir}\n        ${url}`);
    }
}

const command: CommandModule = {
    name: "list",
    hint: "List all known sessions and whether they are live",
    run: async () => {
        await runListCommand();
    },
};

export default command;
