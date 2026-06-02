import path from "node:path";
import { readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { CliOptions, CommandContext, CommandModule } from "./types.js";

export type RuntimeProcessLike = {
    argv: string[];
    cwd: () => string;
};

export type CliCommand = string;

type PromptOption = {
    value: CliCommand;
    label: string;
    hint?: string;
};

let cachedCommands: Map<string, CommandModule> | null = null;

async function loadCommands(): Promise<Map<string, CommandModule>> {
    if (cachedCommands) {
        return cachedCommands;
    }

    const commands = new Map<string, CommandModule>();
    const commandDir = path.dirname(fileURLToPath(import.meta.url));
    const entries = await readdir(commandDir, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isFile()) {
            continue;
        }

        const fileName = entry.name;
        const extension = path.extname(fileName);

        if (extension !== ".js" && extension !== ".ts") {
            continue;
        }

        if (
            fileName === "handler.ts" ||
            fileName === "handler.js" ||
            fileName === "types.ts" ||
            fileName === "types.js"
        ) {
            continue;
        }

        const moduleUrl = pathToFileURL(path.join(commandDir, fileName)).href;
        const mod = (await import(moduleUrl)) as { default?: CommandModule };
        const command = mod.default;

        if (!command || typeof command.name !== "string" || typeof command.run !== "function") {
            continue;
        }

        commands.set(command.name, command);
    }

    cachedCommands = commands;
    return commands;
}

export async function getArgCommand(argv: string[]): Promise<CliCommand | null> {
    const command = argv[2];
    if (!command) {
        return null;
    }

    const commands = await loadCommands();
    return commands.has(command) ? command : null;
}

export async function getCommandPromptOptions(): Promise<PromptOption[]> {
    const commands = await loadCommands();

    return Array.from(commands.values()).map((command) => ({
        value: command.name,
        label: command.label ?? command.name,
        hint: command.hint,
    }));
}

export function parseOptions(runtimeProcess: RuntimeProcessLike): CliOptions {
    const argv = runtimeProcess.argv;
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

export async function runCommand(
    command: CliCommand,
    context: CommandContext
): Promise<void> {
    const commands = await loadCommands();
    const commandModule = commands.get(command);

    if (!commandModule) {
        throw new Error(`Unknown command: ${command}`);
    }

    await commandModule.run(context);
}
