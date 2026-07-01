import path from "node:path";

import { COMMANDS } from "./registry.js";
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

/** Commands indexed by name for O(1) lookup. Built once when the module loads. */
const commandsByName: ReadonlyMap<string, CommandModule> = new Map(
    COMMANDS.map((command) => [command.name, command])
);

export function getArgCommand(argv: string[]): CliCommand | null {
    const command = argv[2];
    if (!command) {
        return null;
    }

    return commandsByName.has(command) ? command : null;
}

export function getCommandPromptOptions(): PromptOption[] {
    return COMMANDS.map((command) => ({
        value: command.name,
        label: command.label ?? command.name,
        hint: command.hint,
    }));
}

export function parseOptions(runtimeProcess: RuntimeProcessLike): CliOptions {
    const argv = runtimeProcess.argv;
    const cwd = runtimeProcess.cwd();
    let title: string | undefined;
    let session: string | undefined;
    let all = false;
    const dirs: string[] = [];

    for (let index = 3; index < argv.length; index += 1) {
        const arg = argv[index];
        if (!arg) {
            continue;
        }

        if (arg === "--title") {
            title = argv[index + 1];
            index += 1;
            continue;
        }

        if (arg === "--session") {
            session = argv[index + 1];
            index += 1;
            continue;
        }

        if (arg === "--dir") {
            const dir = argv[index + 1];
            if (dir) {
                dirs.push(path.resolve(cwd, dir));
            }
            index += 1;
            continue;
        }

        if (arg === "--all") {
            all = true;
            continue;
        }

        // A bare (non-flag) argument is a positional directory to broadcast,
        // enabling `spire start ./backend ./frontend`.
        if (!arg.startsWith("-")) {
            dirs.push(path.resolve(cwd, arg));
        }
    }

    return {
        title,
        session,
        dirs,
        rootDir: dirs[0] ?? cwd,
        cwd,
        all,
    };
}

export function runCommand(
    command: CliCommand,
    context: CommandContext
): Promise<void> {
    const commandModule = commandsByName.get(command);

    if (!commandModule) {
        throw new Error(`Unknown command: ${command}`);
    }

    return commandModule.run(context);
}
