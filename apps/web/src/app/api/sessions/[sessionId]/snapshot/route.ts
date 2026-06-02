import { FileSnapshotSchema } from "@spire/types";
import { failure, readJsonBody, success } from "../../../_lib/http";
import { authorize, ingestSnapshot } from "../../../_lib/state";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
    const auth = authorize(request.headers.get("authorization"));

    if (!auth.ok) {
        if (auth.code === "expired_token") {
            return failure("expired_token", "Access token has expired.", 401);
        }

        return failure("unauthorized", "Missing or invalid bearer token.", 401);
    }

    const { sessionId } = await Promise.resolve(context.params);
    const body = await readJsonBody(request);
    const parsed = FileSnapshotSchema.safeParse(body);

    if (!parsed.success) {
        return failure("invalid_request", "Invalid snapshot payload.", 400, {
            issues: parsed.error.issues,
        });
    }

    if (parsed.data.sessionId !== sessionId) {
        return failure("invalid_request", "Payload sessionId does not match route param.", 400);
    }

    const result = ingestSnapshot(auth.token.instructorId, parsed.data);

    if (!result.ok) {
        if (result.code === "not_found") {
            return failure("not_found", "Session was not found.", 404);
        }

        if (result.code === "forbidden") {
            return failure("forbidden", "You cannot write to this session.", 403);
        }

        return failure("invalid_state", "Session is not active.", 409);
    }

    return success({ accepted: true }, 202);
}
