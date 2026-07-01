import { log } from "@clack/prompts";
import path from "node:path";

import {
    isSessionLive,
    readAllSessions,
    readSessionForDir,
} from "../session/local-session.js";
import type { CliOptions, CommandModule } from "./types.js";

export async function runStatusCommand(options: CliOptions) {
    // If the current directory (or an explicit --dir) has a session, show its
    // details. Otherwise fall back to a summary of every known session.
    const record = await readSessionForDir(options.rootDir);

    if (record) {
        log.info(`Session: ${record.sessionId}`);
        log.info(`Title: ${record.title}`);
        log.info(`Root: ${record.rootDir}`);
        log.info(`Status: ${isSessionLive(record) ? "live" : "not broadcasting"}`);
        log.info(`Share URL: ${record.apiBaseUrl}/session/${record.sessionId}`);
        log.info(`Checkpoints synced: ${record.checkpointsSynced}`);
        log.info(`Started at: ${record.startedAt}`);
        return;
    }

    const all = await readAllSessions();
    if (all.length === 0) {
        log.warn("No sessions found. Run: spire start");
        return;
    }

    log.info("No session for this directory. Known sessions:");
    const sorted = [...all].sort((a, b) => a.rootDir.localeCompare(b.rootDir));
    for (const entry of sorted) {
        const status = isSessionLive(entry) ? "live" : "dead";
        log.message(
            `[${status}] ${entry.title} — ${path.relative(options.cwd, entry.rootDir) || "."}`
        );
    }
}

const command: CommandModule = {
    name: "status",
    hint: "Show session status for this directory or all sessions",
    run: async ({ options }) => {
        await runStatusCommand(options);
    },
};

export default command;
