export type CliOptions = {
    title?: string;
    rootDir: string;
    session?: string;
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
