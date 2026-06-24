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

export async function readJsonBody(request: Request) {
    try {
        return (await request.json()) as unknown;
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
