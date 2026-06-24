import { CreateSessionSchema } from "@spire/types";
import { failure, readJsonBody, routeHandler, success } from "@/server/http";
import { endSession, getSessionById, upsertSession } from "@/server/state";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

export const GET = routeHandler(async (_request: Request, context: RouteContext) => {
    const { sessionId } = await Promise.resolve(context.params);
    const session = await getSessionById(sessionId);

    if (!session) {
        return failure("not_found", "Session was not found.", 404);
    }

    return success(session);
});

export const PUT = routeHandler(async (request: Request, context: RouteContext) => {
    const [{ sessionId }, body] = await Promise.all([
        Promise.resolve(context.params),
        readJsonBody(request),
    ]);
    const parsed = CreateSessionSchema.safeParse(body ?? {});

    if (!parsed.success) {
        return failure("invalid_request", "Invalid session payload.", 400, {
            issues: parsed.error.issues,
        });
    }

    const session = await upsertSession(sessionId, parsed.data);
    return success(session);
});

export const DELETE = routeHandler(async (_request: Request, context: RouteContext) => {
    const { sessionId } = await Promise.resolve(context.params);
    const result = await endSession(sessionId);

    if (!result.ok) {
        if (result.code === "not_found") {
            return failure("not_found", "Session was not found.", 404);
        }

        return failure("invalid_state", "Session is not active.", 409);
    }

    return new Response(null, { status: 204 });
});
