import type {
    Checkpoint,
    CheckpointSummary,
    FileSnapshot,
    SessionResponse,
} from "@spire/types";

export type LoadMode = "eager" | "lazy";

export type SessionState = {
    session: SessionResponse;
    snapshot: FileSnapshot | null;
    checkpoints: CheckpointSummary[];
    mode: LoadMode;
    /**
     * Eager mode only: hash → content map for every current text file. Pre-fills
     * the content-addressed LRU cache so files open instantly without per-file
     * fetches on sessions that fall within the eager-mode size threshold.
     */
    contents?: Record<string, string>;
};

export type FileContent = {
    content: string;
    binary: boolean;
    hash: string;
};

type ApiEnvelope<T> =
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string } };

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { signal, cache: "no-store" });
    const body = (await response.json()) as ApiEnvelope<T>;
    if (!response.ok || !body.ok) {
        const message = body.ok ? response.statusText : body.error.message;
        throw new Error(message || "Request failed.");
    }
    return body.data;
}

/**
 * Fetches the full initial state for a session: the current snapshot tree,
 * recent checkpoint summaries, load mode, and (in eager mode) a content map.
 */
export function fetchSessionState(
    sessionId: string,
    signal?: AbortSignal
): Promise<SessionState> {
    return getJson<SessionState>(`/api/sessions/${sessionId}/state`, signal);
}

/**
 * Fetches a file's content at a specific version. `ref` accepts a 64-hex blob
 * hash for a direct content-addressed lookup, the literal "latest" for the
 * current head version, or a checkpoint sequence number to retrieve the file
 * as it existed at that point in history.
 */
export function fetchFileContent(
    sessionId: string,
    path: string,
    ref: string,
    signal?: AbortSignal
): Promise<FileContent> {
    const query = new URLSearchParams({ path, ref });
    return getJson<FileContent>(
        `/api/sessions/${sessionId}/file?${query.toString()}`,
        signal
    );
}

/**
 * Fetches a single checkpoint with its full per-file change list. Called lazily
 * when the user opens a checkpoint entry in the timeline panel.
 */
export function fetchCheckpoint(
    sessionId: string,
    seq: number,
    signal?: AbortSignal
): Promise<Checkpoint> {
    return getJson<Checkpoint>(
        `/api/sessions/${sessionId}/checkpoints/${seq}`,
        signal
    );
}

/**
 * Fetches a page of checkpoint summaries ordered newest-first. Supports cursor-
 * based pagination via `before` (exclusive seq upper bound) and `limit`.
 */
export async function fetchCheckpoints(
    sessionId: string,
    opts: { before?: number; limit?: number } = {},
    signal?: AbortSignal
): Promise<CheckpointSummary[]> {
    const query = new URLSearchParams();
    if (opts.before !== undefined) {
        query.set("before", String(opts.before));
    }
    if (opts.limit !== undefined) {
        query.set("limit", String(opts.limit));
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const data = await getJson<{ checkpoints: CheckpointSummary[] }>(
        `/api/sessions/${sessionId}/checkpoints${suffix}`,
        signal
    );
    return data.checkpoints;
}
