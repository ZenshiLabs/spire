import {
    ApiResponseSchema,
    type CheckpointUpload,
    CheckpointUploadSchema,
    type CreateSessionInput,
    FileSnapshotSchema,
    SessionResponseSchema,
} from "@spire/types";

const SessionApiResponseSchema = ApiResponseSchema(SessionResponseSchema);

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

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
        const data = await this.request("PUT", `/api/sessions/${sessionId}`, input);
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
     * session's last-seen timestamp.
     */
    async heartbeat(sessionId: string) {
        await this.request("POST", `/api/sessions/${sessionId}/heartbeat`);
    }

    /**
     * Validates and uploads a save-burst checkpoint — a batch of file changes
     * produced by the CheckpointBatcher after an idle or max-wait interval fires.
     * The schema is validated client-side before the network call to surface
     * structural errors without a round-trip.
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
            throw new Error(
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
