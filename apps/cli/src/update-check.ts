import { log } from "@clack/prompts";
import { getInvokedAs } from "./config.js";
import pkg from "../package.json" with { type: "json" };

const PACKAGE_NAME = "@zenshilabs/spire";
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const CHECK_TIMEOUT_MS = 3000;

async function fetchLatestVersion(): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    try {
        const response = await fetch(REGISTRY_URL, { signal: controller.signal });
        if (!response.ok) return null;
        const data = (await response.json()) as { version?: string };
        return typeof data.version === "string" ? data.version : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

function isNewer(current: string, latest: string): boolean {
    const parts = (v: string) => v.split(".").map(Number);
    const c = parts(current);
    const l = parts(latest);
    for (let i = 0; i < 3; i++) {
        const cv = c[i] ?? 0;
        const lv = l[i] ?? 0;
        if (lv !== cv) return lv > cv;
    }
    return false;
}

function updateCommand(): string {
    const invoked = getInvokedAs();
    if (invoked === "spire") {
        return "npm install -g @zenshilabs/spire@latest";
    }
    // One-shot exec (npx/bunx/pnpm dlx/yarn dlx): append @latest to bypass cache
    return `${invoked}@latest`;
}

export async function checkForUpdate(): Promise<void> {
    const latest = await fetchLatestVersion();
    if (!latest || !isNewer(pkg.version, latest)) return;
    log.warn(
        `Update available: ${pkg.version} → ${latest}\n` +
            `Run "${updateCommand()}" to get the latest version.`
    );
}
