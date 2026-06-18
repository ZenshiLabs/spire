import { failure, success } from "../../../../_lib/http";
import { getCheckpoint } from "../../../../_lib/state";

type RouteContext = {
    params:
        | { sessionId: string; seq: string }
        | Promise<{ sessionId: string; seq: string }>;
};

/** A single checkpoint with its full per-file change list. */
export async function GET(_request: Request, context: RouteContext) {
    const { sessionId, seq } = await Promise.resolve(context.params);
    const seqNum = Number(seq);

    if (!Number.isInteger(seqNum) || seqNum < 0) {
        return failure("invalid_request", "Invalid checkpoint seq.", 400);
    }

    const checkpoint = await getCheckpoint(sessionId, seqNum);
    if (!checkpoint) {
        return failure("not_found", "Checkpoint was not found.", 404);
    }

    return success(checkpoint);
}
