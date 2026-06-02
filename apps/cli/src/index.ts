#!/usr/bin/env node
import { cancel, intro, isCancel, log, outro, select } from "@clack/prompts";
import { buildSignInUrl, getClerkAuthConfig } from "@spire/auth";

type CliCommand = "status" | "login";
type RuntimeProcess = {
    argv: string[];
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

    if (command === "status" || command === "login") {
        return command;
    }

    return null;
}

async function promptForCommand(): Promise<CliCommand | null> {
    const selected = await select({
        message: "What do you want to do?",
        options: [
            { value: "status", label: "status", hint: "Show CLI scaffold status" },
            { value: "login", label: "login", hint: "Show Clerk sign-in URL" },
        ],
    });

    if (isCancel(selected)) {
        return null;
    }

    return selected;
}

function runStatusCommand() {
    log.info("Spire CLI scaffold is ready.");
}

function runLoginCommand() {
    const config = getClerkAuthConfig();
    const signInUrl = buildSignInUrl();

    if (!config.publishableKey && !config.secretKey) {
        log.warn("Clerk is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.");
    }

    log.message(`Open this URL to sign in: ${signInUrl}`);
}

async function main() {
    intro("Spire CLI");
    const runtimeProcess = getRuntimeProcess();

    const command = getArgCommand(runtimeProcess.argv) ?? (await promptForCommand());

    if (!command) {
        cancel("Cancelled.");
        runtimeProcess.exit(0);
    }

    if (command === "status") {
        runStatusCommand();
    }

    if (command === "login") {
        runLoginCommand();
    }

    outro("Done");
}

void main().catch((error: unknown) => {
    const runtimeProcess = getRuntimeProcess();
    const message = error instanceof Error ? error.message : String(error);
    log.error(message);
    runtimeProcess.exit(1);
});
