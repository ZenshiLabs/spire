import { DeltaPayloadSchema } from "@spire/types";
import { failure, readJsonBody, success } from "../_lib/http";
import { authorize, ingestDelta } from "../_lib/state";

export async function POST(request: Request) {
    const auth = authorize(request.headers.get("authorization"));

    if (!auth.ok) {
        if (auth.code === "expired_token") {
            return failure("expired_token", "Access token has expired.", 401);
        }

        return failure("unauthorized", "Missing or invalid bearer token.", 401);
    }

    const body = await readJsonBody(request);
    const parsed = DeltaPayloadSchema.safeParse(body);

    if (!parsed.success) {
        return failure("invalid_request", "Invalid delta payload.", 400, {
            issues: parsed.error.issues,
        });
    }

    const result = ingestDelta(auth.token.instructorId, parsed.data);

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
