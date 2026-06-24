import { failure, routeHandler, success } from "@/server/http";
import { buildSessionState } from "@/server/state";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

export const GET = routeHandler(async (_request: Request, context: RouteContext) => {
    const { sessionId } = await Promise.resolve(context.params);
    const state = await buildSessionState(sessionId);

    if (!state) {
        return failure("not_found", "Session was not found.", 404);
    }

    return success(state);
});
