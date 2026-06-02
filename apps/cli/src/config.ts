import { homedir } from "node:os";
import path from "node:path";

export type RuntimeEnv = Record<string, string | undefined>;

type RuntimeProcess = {
    env?: RuntimeEnv;
};

function getRuntimeProcess(): RuntimeProcess {
    const runtime = globalThis as { process?: RuntimeProcess };
    return runtime.process ?? {};
}

export function getRuntimeEnv(): RuntimeEnv {
    return getRuntimeProcess().env ?? {};
}

export function getApiBaseUrl(env: RuntimeEnv = getRuntimeEnv()): string {
    return env.SPIRE_API_URL ?? env.API_BASE_URL ?? "http://localhost:3000";
}

export function getSpireDataDir(): string {
    return path.join(homedir(), ".spire");
}

export function getCredentialsPath(): string {
    return path.join(getSpireDataDir(), "credentials.json");
}

export function getActiveSessionPath(): string {
    return path.join(getSpireDataDir(), "active-session.json");
}

export function toPosixPath(filePath: string): string {
    return filePath.replaceAll("\\", "/");
}
