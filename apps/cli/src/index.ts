#!/usr/bin/env node
import { cancel, intro, isCancel, log, outro, select } from "@clack/prompts";

import { getApiBaseUrl } from "./config.js";
import {
    type CliCommand,
    getArgCommand,
    getCommandPromptOptions,
    parseOptions,
    runCommand,
} from "./commands/handler.js";

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

async function promptForCommand(): Promise<CliCommand | null> {
    const options = await getCommandPromptOptions();

    const selected = await select({
        message: "What do you want to do?",
        options,
    });

    if (isCancel(selected)) {
        return null;
    }

    return selected;
}

async function main() {
    intro("Spire CLI");
    const runtimeProcess = getRuntimeProcess();
    const apiBaseUrl = getApiBaseUrl();

    const command = (await getArgCommand(runtimeProcess.argv)) ?? (await promptForCommand());
    const options = parseOptions(runtimeProcess);

    if (!command) {
        cancel("Cancelled.");
        runtimeProcess.exit(0);
        return;
    }

    await runCommand(command, { apiBaseUrl, options });

    outro("Done");
}

void main().catch((error: unknown) => {
    const runtimeProcess = getRuntimeProcess();
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    runtimeProcess.exit(1);
});
