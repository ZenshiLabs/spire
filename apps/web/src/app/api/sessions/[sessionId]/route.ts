import { CreateSessionSchema } from "@spire/types";
import { failure, readJsonBody, success } from "../../_lib/http";
import { endSession, getSessionById, upsertSession } from "../../_lib/state";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
    const { sessionId } = await Promise.resolve(context.params);
    const session = await getSessionById(sessionId);

    if (!session) {
        return failure("not_found", "Session was not found.", 404);
    }

    return success(session);
}

export async function PUT(request: Request, context: RouteContext) {
    const { sessionId } = await Promise.resolve(context.params);
    const body = await readJsonBody(request);
    const parsed = CreateSessionSchema.safeParse(body ?? {});

    if (!parsed.success) {
        return failure("invalid_request", "Invalid session payload.", 400, {
            issues: parsed.error.issues,
        });
    }

    const session = await upsertSession(sessionId, parsed.data);
    return success(session);
}

export async function DELETE(_request: Request, context: RouteContext) {
    const { sessionId } = await Promise.resolve(context.params);
    const result = await endSession(sessionId);

    if (!result.ok) {
        if (result.code === "not_found") {
            return failure("not_found", "Session was not found.", 404);
        }

        return failure("invalid_state", "Session is not active.", 409);
    }

    return new Response(null, { status: 204 });
}
