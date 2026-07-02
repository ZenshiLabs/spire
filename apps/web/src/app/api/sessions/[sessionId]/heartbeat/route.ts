import { Effect } from "effect";
import { touchSession } from "@spire/server";
import { failure, routeHandler } from "@/server/http";
import { RATE_LIMITS } from "@/server/limits";
import { rateLimit } from "@/server/rate-limit";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

/**
 * Liveness ping from the broadcasting CLI. Bumps the session's last-seen time so
 * it stays inside the staleness window even while idle. Bodyless and cheap. An
 * unknown session is a 404 and an already-ended session is a 409 so a stale CLI
 * learns it must reactivate (PUT) rather than keep heartbeating a dead session.
 */
export const POST = routeHandler(async (_request: Request, context: RouteContext) => {
    const { sessionId } = await Promise.resolve(context.params);

    if (!(await rateLimit(`heartbeat:${sessionId}`, RATE_LIMITS.heartbeat))) {
        return failure("rate_limited", "Too many heartbeats.", 429);
    }

    const result = await Effect.runPromise(touchSession(sessionId));

    if (result === "not_found") {
        return failure("not_found", "Session was not found.", 404);
    }
    if (result === "ended") {
        return failure("inactive_session", "Session has ended.", 409);
    }

    return new Response(null, { status: 204 });
});
