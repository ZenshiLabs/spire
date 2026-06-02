#!/usr/bin/env node
import { cancel, intro, isCancel, log, outro, select } from "@clack/prompts";
import path from "node:path";

import { getApiBaseUrl } from "./config.js";
import { runLoginCommand } from "./commands/login.js";
import { runStartCommand } from "./commands/start.js";
import { runStatusCommand } from "./commands/status.js";
import { runStopCommand } from "./commands/stop.js";

type CliCommand = "status" | "login" | "start" | "stop";
type RuntimeProcess = {
    argv: string[];
    cwd: () => string;
    exit: (code?: number) => never;
};

function getRuntimeProcess(): RuntimeProcess {
    const runtime = globalThis as { process?: RuntimeProcess };

    if (!runtime.process) {
        throw new Error("Spire CLI must run in a Node.js environment.");
    }

    return runtime.process;
}

function getArgCommand(argv: string[]): CliCommand | null {
    const command = argv[2];

    if (
        command === "status" ||
        command === "login" ||
        command === "start" ||
        command === "stop"
    ) {
        return command;
    }

    return null;
}

async function promptForCommand(): Promise<CliCommand | null> {
    const selected = await select({
        message: "What do you want to do?",
        options: [
            { value: "status", label: "status", hint: "Show auth/session state" },
            { value: "login", label: "login", hint: "Run device authorization flow" },
            { value: "start", label: "start", hint: "Start session and watch files" },
            { value: "stop", label: "stop", hint: "Stop active session" },
        ],
    });

    if (isCancel(selected)) {
        return null;
    }

    return selected;
}

type CliOptions = {
    title?: string;
    rootDir: string;
}

function parseOptions(argv: string[], runtimeProcess: RuntimeProcess): CliOptions {
    let title: string | undefined;
    let rootDir = runtimeProcess.cwd();

    for (let index = 3; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === "--title") {
            title = argv[index + 1];
            index += 1;
            continue;
        }

        if (arg === "--dir") {
            const dir = argv[index + 1];
            if (dir) {
                rootDir = path.resolve(runtimeProcess.cwd(), dir);
            }
            index += 1;
        }
    }

    return {
        title,
        rootDir,
    };
}

async function main() {
    intro("Spire CLI");
    const runtimeProcess = getRuntimeProcess();
    const apiBaseUrl = getApiBaseUrl();

    const command = getArgCommand(runtimeProcess.argv) ?? (await promptForCommand());
    const options = parseOptions(runtimeProcess.argv, runtimeProcess);

    if (!command) {
        cancel("Cancelled.");
        runtimeProcess.exit(0);
    }

    if (command === "status") {
        await runStatusCommand();
    }

    if (command === "login") {
        await runLoginCommand(apiBaseUrl);
    }

    if (command === "start") {
        await runStartCommand({
            apiBaseUrl,
            rootDir: options.rootDir,
            title: options.title,
        });
    }

    if (command === "stop") {
        await runStopCommand(apiBaseUrl);
    }

    outro("Done");
}

void main().catch((error: unknown) => {
    const runtimeProcess = getRuntimeProcess();
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    runtimeProcess.exit(1);
});
