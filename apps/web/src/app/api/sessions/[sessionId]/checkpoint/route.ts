import { CheckpointUploadSchema } from "@spire/types";
import { failure, readJsonBody, success } from "../../../_lib/http";
import { ingestCheckpoint } from "../../../_lib/state";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
    const { sessionId } = await Promise.resolve(context.params);
    const body = await readJsonBody(request);
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

    const result = await ingestCheckpoint(parsed.data);

    if (!result.ok) {
        if (result.code === "not_found") {
            return failure("not_found", "Session was not found.", 404);
        }
        return failure("invalid_state", "Session is not active.", 409);
    }

    return success({ accepted: true }, 202);
}
