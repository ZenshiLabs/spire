import { CheckpointUploadSchema } from "@spire/types";
import { ingestCheckpoint } from "@spire/server";
import {
    failure,
    PAYLOAD_TOO_LARGE,
    readJsonBody,
    routeHandler,
    success,
} from "@/server/http";
import { PAYLOAD_LIMITS, RATE_LIMITS } from "@/server/limits";
import { rateLimit } from "@/server/rate-limit";
import { run } from "@/server/runtime";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

export const POST = routeHandler(async (request: Request, context: RouteContext) => {
    const { sessionId } = await Promise.resolve(context.params);

    if (!(await rateLimit(`checkpoint:${sessionId}`, RATE_LIMITS.checkpoint))) {
        return failure("rate_limited", "Too many checkpoint uploads.", 429);
    }

    const body = await readJsonBody(request, PAYLOAD_LIMITS.checkpoint);
    if (body === PAYLOAD_TOO_LARGE) {
        return failure("payload_too_large", "Checkpoint payload is too large.", 413);
    }
    const parsed = CheckpointUploadSchema.safeParse(body);

    if (!parsed.success) {
        return failure("invalid_request", "Invalid checkpoint payload.", 400, {
            issues: parsed.error.issues,
        });
    }

    if (parsed.data.sessionId !== sessionId) {
        return failure(
            "invalid_request",
            "Payload sessionId does not match route param.",
            400
        );
    }

    const result = await run(ingestCheckpoint(parsed.data));

    if (!result.ok) {
        if (result.code === "not_found") {
            return failure("not_found", "Session was not found.", 404);
        }
        return failure("invalid_state", "Session is not active.", 409);
    }

    return success({ accepted: true }, 202);
});
