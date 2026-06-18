import path from "node:path";

import { CheckpointUploadSchema, type CheckpointUpload } from "@spire/types";

/**
 * Per-file content size ceiling applied to checkpoint entry payloads sent over
 * the wire. The initial snapshot builder already excludes files above
 * MAX_FILE_BYTES at the watcher level; this serves as an independent backstop
 * specifically for checkpoint entries to guard against a file growing past the
 * limit between the snapshot and a subsequent save.
 */
const MAX_ENTRY_BYTES = 5 * 1024 * 1024;

export function validateCheckpointUpload(
    payload: CheckpointUpload
): { ok: true } | { ok: false; reason: string } {
    const parsed = CheckpointUploadSchema.safeParse(payload);
    if (!parsed.success) {
        return {
            ok: false,
            reason: parsed.error.issues
                .map((issue: { message: string }) => issue.message)
                .join(", "),
        };
    }

    for (const entry of payload.entries) {
        const normalized = path.posix.normalize(entry.path);
        if (normalized.startsWith("../") || normalized.includes("/../")) {
            return {
                ok: false,
                reason: `Path traversal is not allowed: ${entry.path}`,
            };
        }
        if (entry.content && Buffer.byteLength(entry.content, "utf8") > MAX_ENTRY_BYTES) {
            return {
                ok: false,
                reason: `Entry ${entry.path} exceeds the 5MB content limit.`,
            };
        }
    }

    return { ok: true };
}
