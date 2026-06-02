import { failure } from "../../_lib/http";
import { authorize, endSession } from "../../_lib/state";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

export async function DELETE(request: Request, context: RouteContext) {
    const auth = authorize(request.headers.get("authorization"));

    if (!auth.ok) {
        if (auth.code === "expired_token") {
            return failure("expired_token", "Access token has expired.", 401);
        }

        return failure("unauthorized", "Missing or invalid bearer token.", 401);
    }

    const { sessionId } = await Promise.resolve(context.params);
    const result = endSession(sessionId, auth.token.instructorId);

    if (!result.ok) {
        if (result.code === "not_found") {
            return failure("not_found", "Session was not found.", 404);
        }

        if (result.code === "forbidden") {
            return failure("forbidden", "You cannot stop this session.", 403);
        }

        return failure("invalid_state", "Session is not active.", 409);
    }

    return new Response(null, { status: 204 });
}
