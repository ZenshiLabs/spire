import startCommand from "./start.js";
import statusCommand from "./status.js";
import stopCommand from "./stop.js";
import type { CommandModule } from "./types.js";

/**
 * The full set of CLI commands, wired up at build time. Registering them
 * statically — rather than scanning this directory and dynamically importing
 * each file at startup — lets the bundler fold every command into the single
 * output file, keeps startup free of filesystem I/O, and turns a missing
 * command into a compile error instead of a silent runtime no-op.
 *
 * To add a command: create its module, then add it to this list.
 */
export const COMMANDS: readonly CommandModule[] = [
    startCommand,
    statusCommand,
    stopCommand,
];
