import { CreateSessionSchema } from "@spire/types";
import { failure, readJsonBody, success } from "../_lib/http";
import { authorize, createSession } from "../_lib/state";

export async function POST(request: Request) {
    const auth = authorize(request.headers.get("authorization"));

    if (!auth.ok) {
        if (auth.code === "expired_token") {
            return failure("expired_token", "Access token has expired.", 401);
        }

        return failure("unauthorized", "Missing or invalid bearer token.", 401);
    }

    const body = await readJsonBody(request);
    const parsed = CreateSessionSchema.safeParse(body);

    if (!parsed.success) {
        return failure("invalid_request", "Invalid session payload.", 400, {
            issues: parsed.error.issues,
        });
    }

    const session = createSession(auth.token.instructorId, parsed.data);
    return success(session, 201);
}
