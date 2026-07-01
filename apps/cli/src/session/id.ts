import { randomBytes } from "node:crypto";

/**
 * Generates a URL-safe 8-character base36 token (e.g. "k3f9zq2a"). Uses
 * `crypto.randomBytes` so each value is cryptographically unpredictable —
 * suitable for a shareable-but-unguessable identifier.
 */
export function generateToken(): string {
    return Array.from(randomBytes(8))
        .map((byte) => (byte % 36).toString(36))
        .join("");
}

/** A fresh session ID for a broadcast that has never been started before. */
export function generateSessionId(): string {
    return generateToken();
}

/** A fresh workspace ID linking the sessions started from one `spire.json`. */
export function generateWorkspaceId(): string {
    return `ws-${generateToken()}`;
}
