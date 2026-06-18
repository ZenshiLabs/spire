import { failure, success } from "../../../_lib/http";
import { buildSessionState } from "../../../_lib/state";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
    const { sessionId } = await Promise.resolve(context.params);
    const state = await buildSessionState(sessionId);

    if (!state) {
        return failure("not_found", "Session was not found.", 404);
    }

    return success(state);
}
