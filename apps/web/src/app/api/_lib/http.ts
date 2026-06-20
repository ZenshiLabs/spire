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
