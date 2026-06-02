import { log, spinner } from "@clack/prompts";

import { SpireApiClient } from "../api/client.js";

function sleep(ms: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
    });
}

export async function runDeviceFlow(
    client: SpireApiClient,
    options: {
        clientId?: string;
        scope?: string;
        timeoutMs?: number;
    } = {}
) {
    const clientId = options.clientId ?? "spire-cli";
    const scope = options.scope ?? "session:write";

    const deviceCodeResponse = await client.requestDeviceCode(clientId, scope);
    const timeoutMs = options.timeoutMs ?? deviceCodeResponse.expiresIn * 1000;

    log.step(`Open ${deviceCodeResponse.verificationUri} and enter code ${deviceCodeResponse.userCode}.`);

    const start = Date.now();
    const s = spinner();
    s.start("Waiting for device authorization...");

    while (Date.now() - start < timeoutMs) {
        try {
            const tokenResponse = await client.requestDeviceToken(deviceCodeResponse.deviceCode);
            s.stop("Authorization completed.");
            return tokenResponse;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);

            if (/authorization_pending|slow_down|not approved/i.test(message)) {
                await sleep(deviceCodeResponse.interval * 1000);
                continue;
            }

            s.stop("Authorization failed.");
            throw error;
        }
    }

    s.stop("Authorization timed out.");
    throw new Error("Device login timed out before approval.");
}
