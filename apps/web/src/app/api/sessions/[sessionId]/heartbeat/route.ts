import { failure } from "../../../_lib/http";
import { touchSession } from "../../../_lib/state";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

/**
 * Liveness ping from the broadcasting CLI. Bumps the session's last-seen time so
 * it stays inside the staleness window even while idle. Bodyless and cheap; an
 * unknown session is a 404 so a stale CLI learns its session is gone.
 */
export async function POST(_request: Request, context: RouteContext) {
    const { sessionId } = await Promise.resolve(context.params);
    const touched = await touchSession(sessionId);

    if (!touched) {
        return failure("not_found", "Session was not found.", 404);
    }

    return new Response(null, { status: 204 });
}
