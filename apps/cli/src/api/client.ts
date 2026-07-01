import {
    ApiResponseSchema,
    type CheckpointUpload,
    CheckpointUploadSchema,
    type CreateSessionInput,
    FileSnapshotSchema,
    type SessionManifest,
    SessionManifestSchema,
    SessionResponseSchema,
} from "@spire/types";

const SessionApiResponseSchema = ApiResponseSchema(SessionResponseSchema);
const ManifestApiResponseSchema = ApiResponseSchema(SessionManifestSchema);

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

/** Error thrown for a non-2xx HTTP response, carrying the status for callers. */
export class SpireApiError extends Error {
    constructor(
        readonly status: number,
        message: string
    ) {
        super(message);
        this.name = "SpireApiError";
    }
}

/**
 * Thrown when a session manifest is requested from a server that predates the
 * endpoint (HTTP 404). Lets the caller fall back to a full snapshot upload
 * rather than treating an old server as an empty session.
 */
export class ManifestUnavailableError extends Error {
    constructor() {
        super("Session manifest endpoint is unavailable.");
        this.name = "ManifestUnavailableError";
    }
}

const DEFAULT_MAX_ATTEMPTS = 4;

/** Retry only on transient failures: network errors, rate limits, and 5xx. */
function isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
}

function backoffDelayMs(attempt: number): number {
    // 500ms, 1s, 2s, 4s, ... with up to 50% jitter to avoid thundering herds.
    const base = 500 * 2 ** (attempt - 1);
    return base + Math.random() * base * 0.5;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

type RequestOptions = {
    /** Whether transient failures should be retried. Defaults to true. */
    retryable?: boolean;
    /** Maximum attempts including the first. Defaults to 4 when retryable. */
    maxAttempts?: number;
};

export class SpireApiClient {
    constructor(private readonly baseUrl: string) {}

    /**
     * Creates the session if it does not exist, or reactivates an ended one.
     * Idempotent — re-running the CLI for the same ID yields a live session
     * without wiping history or resetting the share URL. The server may return
     * either an envelope `{ ok, data }` or a bare SessionResponse; both shapes
     * are handled here for forward compatibility.
     */
    async ensureSession(sessionId: string, input: CreateSessionInput) {
        // Startup is interactive: fail fast rather than making the user wait
        // through the full backoff schedule when the server is unreachable.
        const data = await this.request("PUT", `/api/sessions/${sessionId}`, input, {
            maxAttempts: 2,
        });
        const wrapped = SessionApiResponseSchema.safeParse(data);

        if (wrapped.success) {
            if (!wrapped.data.ok) {
                throw new Error(wrapped.data.error.message);
            }

            return wrapped.data.data;
        }

        return SessionResponseSchema.parse(data);
    }

    async endSession(sessionId: string) {
        await this.request("DELETE", `/api/sessions/${sessionId}`);
    }

    /**
     * Pings the server to report that this broadcast is still live. The server
     * treats a session whose last heartbeat (or checkpoint) has gone stale as
     * ended, so an idle broadcast that sends no checkpoints still needs these to
     * keep its viewers showing "live". Cheap and bodyless — just bumps the
     * session's last-seen timestamp. Not retried; the next tick is the retry.
     */
    async heartbeat(sessionId: string) {
        await this.request("POST", `/api/sessions/${sessionId}/heartbeat`, undefined, {
            retryable: false,
        });
    }

    /**
     * Fetches the server's current head-file manifest (path + hash per file)
     * so the CLI can diff local state against it on rejoin and upload only what
     * changed instead of re-sending the whole snapshot. Throws
     * ManifestUnavailableError against servers without the endpoint.
     */
    async getManifest(sessionId: string): Promise<SessionManifest> {
        let data: unknown;
        try {
            data = await this.request("GET", `/api/sessions/${sessionId}/manifest`, undefined, {
                maxAttempts: 2,
            });
        } catch (error) {
            if (error instanceof SpireApiError && error.status === 404) {
                throw new ManifestUnavailableError();
            }
            throw error;
        }
        const wrapped = ManifestApiResponseSchema.safeParse(data);
        if (wrapped.success) {
            if (!wrapped.data.ok) {
                throw new Error(wrapped.data.error.message);
            }
            return wrapped.data.data;
        }
        return SessionManifestSchema.parse(data);
    }

    /**
     * Validates and uploads a save-burst checkpoint — a batch of file changes
     * produced by the CheckpointBatcher after an idle or max-wait interval fires.
     * The schema is validated client-side before the network call to surface
     * structural errors without a round-trip. Retried on transient failures so a
     * brief network blip does not drop the batch.
     */
    async pushCheckpoint(sessionId: string, payload: CheckpointUpload) {
        const parsed = CheckpointUploadSchema.parse(payload);
        await this.request("POST", `/api/sessions/${sessionId}/checkpoint`, parsed);
    }

    async uploadSnapshot(sessionId: string, payload: unknown) {
        const parsed = FileSnapshotSchema.parse(payload);
        await this.request("POST", `/api/sessions/${sessionId}/snapshot`, parsed);
    }

    private async request(
        method: HttpMethod,
        route: string,
        body?: unknown,
        options: RequestOptions = {}
    ): Promise<unknown> {
        const retryable = options.retryable ?? true;
        const maxAttempts = retryable ? (options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS) : 1;

        let lastError: unknown;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                return await this.attempt(method, route, body);
            } catch (error) {
                lastError = error;
                const status = error instanceof SpireApiError ? error.status : 0;
                // A concrete 4xx (other than 429) is a client error: retrying
                // will not change the outcome, so surface it immediately.
                const transient = status === 0 || isRetryableStatus(status);
                if (!transient || attempt >= maxAttempts) {
                    throw error;
                }
                await sleep(backoffDelayMs(attempt));
            }
        }
        throw lastError;
    }

    private async attempt(
        method: HttpMethod,
        route: string,
        body?: unknown
    ): Promise<unknown> {
        const response = await fetch(`${this.baseUrl}${route}`, {
            method,
            headers: {
                "content-type": "application/json",
            },
            body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new SpireApiError(
                response.status,
                `Request failed (${response.status} ${response.statusText})${errorBody ? `: ${errorBody}` : ""}`
            );
        }

        if (response.status === 204) {
            return null;
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
            return (await response.json()) as unknown;
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }
}
