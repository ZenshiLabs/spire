import {
    ApiResponseSchema,
    type CreateSessionInput,
    DeltaPayloadSchema,
    DeviceCodeResponseSchema,
    SessionResponseSchema,
    TokenResponseSchema,
} from "@spire/types";

const SessionApiResponseSchema = ApiResponseSchema(SessionResponseSchema);
const DeviceCodeApiResponseSchema = ApiResponseSchema(DeviceCodeResponseSchema);
const TokenApiResponseSchema = ApiResponseSchema(TokenResponseSchema);

type HttpMethod = "GET" | "POST" | "DELETE";

export class SpireApiClient {
    constructor(private readonly baseUrl: string) { }

    async requestDeviceCode(clientId: string, scope: string) {
        const data = await this.request("POST", "/api/auth/device", {
            clientId,
            scope,
        });

        const wrapped = DeviceCodeApiResponseSchema.safeParse(data);
        if (wrapped.success) {
            if (!wrapped.data.ok) {
                throw new Error(wrapped.data.error.message);
            }

            return wrapped.data.data;
        }

        return DeviceCodeResponseSchema.parse(data);
    }

    async requestDeviceToken(deviceCode: string) {
        const data = await this.request("POST", "/api/auth/token", { deviceCode });

        const wrapped = TokenApiResponseSchema.safeParse(data);
        if (wrapped.success) {
            if (!wrapped.data.ok) {
                throw new Error(wrapped.data.error.message);
            }

            return wrapped.data.data;
        }

        return TokenResponseSchema.parse(data);
    }

    async createSession(input: CreateSessionInput, accessToken: string) {
        const data = await this.request("POST", "/api/sessions", input, accessToken);
        const wrapped = SessionApiResponseSchema.safeParse(data);

        if (wrapped.success) {
            if (!wrapped.data.ok) {
                throw new Error(wrapped.data.error.message);
            }

            return wrapped.data.data;
        }

        return SessionResponseSchema.parse(data);
    }

    async endSession(sessionId: string, accessToken: string) {
        await this.request("DELETE", `/api/sessions/${sessionId}`, undefined, accessToken);
    }

    async pushDelta(accessToken: string, payload: unknown) {
        const parsed = DeltaPayloadSchema.parse(payload);
        await this.request("POST", "/api/delta", parsed, accessToken);
    }

    private async request(
        method: HttpMethod,
        route: string,
        body?: unknown,
        accessToken?: string
    ): Promise<unknown> {
        const response = await fetch(`${this.baseUrl}${route}`, {
            method,
            headers: {
                "content-type": "application/json",
                ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
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
