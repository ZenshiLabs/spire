import { createClerkClient } from "@clerk/backend";

type RuntimeEnv = Record<string, string | undefined>;

function getRuntimeEnv(): RuntimeEnv {
    const runtime = globalThis as { process?: { env?: RuntimeEnv } };
    return runtime.process?.env ?? {};
}

export type ClerkAuthConfig = {
    publishableKey: string | null;
    secretKey: string | null;
    signInUrl: string;
};

export function getClerkAuthConfig(env: RuntimeEnv = getRuntimeEnv()): ClerkAuthConfig {
    return {
        publishableKey: env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? null,
        secretKey: env.CLERK_SECRET_KEY ?? null,
        signInUrl: env.CLERK_SIGN_IN_URL ?? "https://clerk.com/sign-in",
    };
}

export function createServerClerkClient(env: RuntimeEnv = getRuntimeEnv()) {
    const config = getClerkAuthConfig(env);

    if (!config.secretKey) {
        throw new Error("CLERK_SECRET_KEY is required to create a Clerk backend client.");
    }

    return createClerkClient({ secretKey: config.secretKey });
}

export function buildSignInUrl(redirectUrl?: string, env: RuntimeEnv = getRuntimeEnv()) {
    const config = getClerkAuthConfig(env);

    if (!redirectUrl) {
        return config.signInUrl;
    }

    const separator = config.signInUrl.includes("?") ? "&" : "?";
    return `${config.signInUrl}${separator}redirect_url=${encodeURIComponent(redirectUrl)}`;
}

export function isClerkConfigured(env: RuntimeEnv = getRuntimeEnv()) {
    const config = getClerkAuthConfig(env);
    return Boolean(config.publishableKey || config.secretKey);
}
