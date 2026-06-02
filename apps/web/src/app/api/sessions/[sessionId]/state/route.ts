import { failure, success } from "../../../_lib/http";
import {
    getSessionById,
    getSessionDeltas,
    getSessionSnapshot,
} from "../../../_lib/state";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
    const { sessionId } = await Promise.resolve(context.params);
    const session = getSessionById(sessionId);

    if (!session) {
        return failure("not_found", "Session was not found.", 404);
    }

    return success({
        session,
        snapshot: getSessionSnapshot(sessionId),
        deltas: getSessionDeltas(sessionId),
    });
}
