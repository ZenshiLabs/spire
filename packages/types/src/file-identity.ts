/** Matches a valid SHA-256 blob hash (64 lowercase or uppercase hex digits). */
export const HASH_RE = /^[0-9a-f]{64}$/i;

export function isValidHash(value: string): boolean {
    return HASH_RE.test(value);
}

/**
 * Returns the final path segment of a virtual forward-slash path.
 * Equivalent to POSIX basename — no filesystem access.
 */
export function baseName(path: string): string {
    const parts = path.split("/");
    return parts[parts.length - 1] ?? path;
}
