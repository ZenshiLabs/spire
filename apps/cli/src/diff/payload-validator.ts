import path from "node:path";

import { DeltaPayloadSchema, type DeltaPayload } from "@spire/types";

const MAX_DELTA_BYTES = 50 * 1024 * 1024;

export function validateDeltaPayload(payload: DeltaPayload): { ok: true } | { ok: false; reason: string } {
    const parsed = DeltaPayloadSchema.safeParse(payload);
    if (!parsed.success) {
        return {
            ok: false,
            reason: parsed.error.issues
                .map((issue: { message: string }) => issue.message)
                .join(", "),
        };
    }

    const normalizedPath = path.posix.normalize(payload.filePath);
    if (normalizedPath.startsWith("../") || normalizedPath.includes("/../")) {
        return { ok: false, reason: "Path traversal is not allowed." };
    }

    const payloadSize = Buffer.byteLength(payload.unifiedDiff, "utf8");
    if (payloadSize > MAX_DELTA_BYTES) {
        return { ok: false, reason: "Delta payload exceeds 50MB limit." };
    }

    return { ok: true };
}
