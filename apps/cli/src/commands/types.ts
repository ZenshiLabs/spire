export type CliOptions = {
    title?: string;
    session?: string;
    /** Absolute directories to broadcast, from positional args and `--dir`. */
    dirs: string[];
    /** Convenience single target: dirs[0] when present, otherwise the cwd. */
    rootDir: string;
    /** The directory the CLI was invoked from, used for workspace resolution. */
    cwd: string;
    /** Whether `--all` was passed (used by `stop`). */
    all: boolean;
};

export type CommandContext = {
    apiBaseUrl: string;
    options: CliOptions;
};

export type CommandModule = {
    name: string;
    label?: string;
    hint?: string;
    run: (context: CommandContext) => Promise<void>;
};
