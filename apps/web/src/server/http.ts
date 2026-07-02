import { NextResponse } from "next/server";

type ErrorDetails = Record<string, unknown> | undefined;

export function success<T>(data: T, status = 200, headers?: HeadersInit) {
    return NextResponse.json({ ok: true, data }, { status, headers });
}

export function failure(
    code: string,
    message: string,
    status: number,
    details?: ErrorDetails
) {
    return NextResponse.json(
        {
            ok: false,
            error: {
                code,
                message,
                ...(details ? { details } : {}),
            },
        },
        { status }
    );
}

/** Sentinel returned when a request body exceeds the configured size cap. */
export const PAYLOAD_TOO_LARGE = Symbol("payload_too_large");

/**
 * Reads and JSON-parses a request body, rejecting anything larger than
 * `maxBytes`. The Content-Length header is checked first as a fast path, then
 * the body is streamed with a running byte count so a missing or lying header
 * cannot smuggle an oversized payload past the cap. Returns null on malformed
 * JSON and the PAYLOAD_TOO_LARGE sentinel when the limit is exceeded.
 */
export async function readJsonBody(
    request: Request,
    maxBytes = Number.POSITIVE_INFINITY
): Promise<unknown | typeof PAYLOAD_TOO_LARGE> {
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes) {
        return PAYLOAD_TOO_LARGE;
    }

    if (!request.body || maxBytes === Number.POSITIVE_INFINITY) {
        try {
            return (await request.json()) as unknown;
        } catch {
            return null;
        }
    }

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
                total += value.byteLength;
                if (total > maxBytes) {
                    await reader.cancel().catch(() => {});
                    return PAYLOAD_TOO_LARGE;
                }
                chunks.push(value);
            }
        }
    } catch {
        return null;
    }

    try {
        const buffer = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return JSON.parse(new TextDecoder().decode(buffer)) as unknown;
    } catch {
        return null;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function routeHandler<T extends (...args: any[]) => Promise<Response>>(fn: T): T {
    return (async (...args: Parameters<T>) => {
        try {
            return await fn(...args);
        } catch (err) {
            console.error("[API Error]", err);
            return failure("internal_error", "An unexpected error occurred.", 500);
        }
    }) as T;
}
