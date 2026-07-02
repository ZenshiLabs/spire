import { CreateSessionSchema } from "@spire/types";
import { endSession, getSessionById, upsertSession } from "@spire/server";
import {
    failure,
    PAYLOAD_TOO_LARGE,
    readJsonBody,
    routeHandler,
    success,
} from "@/server/http";
import { clientIp, PAYLOAD_LIMITS, RATE_LIMITS } from "@/server/limits";
import { rateLimit } from "@/server/rate-limit";
import { run } from "@/server/runtime";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

export const GET = routeHandler(async (_request: Request, context: RouteContext) => {
    const { sessionId } = await Promise.resolve(context.params);
    const session = await run(getSessionById(sessionId));

    if (!session) {
        return failure("not_found", "Session was not found.", 404);
    }

    return success(session);
});

export const PUT = routeHandler(async (request: Request, context: RouteContext) => {
    const { sessionId } = await Promise.resolve(context.params);

    if (!(await rateLimit(`session:${clientIp(request)}`, RATE_LIMITS.session))) {
        return failure("rate_limited", "Too many session requests.", 429);
    }

    const body = await readJsonBody(request, PAYLOAD_LIMITS.session);
    if (body === PAYLOAD_TOO_LARGE) {
        return failure("payload_too_large", "Session payload is too large.", 413);
    }
    const parsed = CreateSessionSchema.safeParse(body ?? {});

    if (!parsed.success) {
        return failure("invalid_request", "Invalid session payload.", 400, {
            issues: parsed.error.issues,
        });
    }

    const session = await run(upsertSession(sessionId, parsed.data));
    return success(session);
});

export const DELETE = routeHandler(async (_request: Request, context: RouteContext) => {
    const { sessionId } = await Promise.resolve(context.params);
    const result = await run(endSession(sessionId));

    if (!result.ok) {
        if (result.code === "not_found") {
            return failure("not_found", "Session was not found.", 404);
        }

        return failure("invalid_state", "Session is not active.", 409);
    }

    return new Response(null, { status: 204 });
});
