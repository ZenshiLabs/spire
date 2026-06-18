/**
 * Returns true when the buffer contains a NUL byte, treating the file as binary.
 *
 * This is the same heuristic git uses to decide whether a file is text or binary.
 * It matters here because file content is embedded verbatim in the JSON snapshot
 * and checkpoint payloads, which are stored in Postgres. Postgres rejects NUL
 * bytes in text/JSON columns (error 22P05, "unsupported Unicode escape sequence"),
 * so attempting to embed a PNG as UTF-8 would produce a large payload that fails
 * the upload after a long delay. Detecting binary files up front lets the snapshot
 * list them without ever embedding their raw bytes.
 */
export function isBinaryContent(buffer: Buffer): boolean {
    return buffer.includes(0);
}
