import { log } from "@clack/prompts";

import { SpireApiClient } from "../api/client.js";
import { runDeviceFlow } from "../auth/device-flow.js";
import { writeStoredToken } from "../auth/token-store.js";
import type { CommandModule } from "./types.js";

export async function runLoginCommand(apiBaseUrl: string) {
    const client = new SpireApiClient(apiBaseUrl);
    const token = await runDeviceFlow(client);

    await writeStoredToken({
        accessToken: token.accessToken,
        tokenType: token.tokenType,
        refreshToken: token.refreshToken,
        expiresAt: Date.now() + token.expiresIn * 1000,
    });

    log.success("Login successful. Credentials were saved to ~/.spire/credentials.json");
}

const command: CommandModule = {
    name: "login",
    hint: "Run device authorization flow",
    run: async ({ apiBaseUrl }) => {
        await runLoginCommand(apiBaseUrl);
    },
};

export default command;
