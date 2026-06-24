import { FileSnapshotSchema } from "@spire/types";
import { ingestSnapshot } from "@spire/server";
import { failure, readJsonBody, routeHandler, success } from "@/server/http";
import { run } from "@/server/runtime";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

export const POST = routeHandler(async (request: Request, context: RouteContext) => {
    const [{ sessionId }, body] = await Promise.all([
        Promise.resolve(context.params),
        readJsonBody(request),
    ]);
    const parsed = FileSnapshotSchema.safeParse(body);

    if (!parsed.success) {
        return failure("invalid_request", "Invalid snapshot payload.", 400, {
            issues: parsed.error.issues,
        });
    }

    if (parsed.data.sessionId !== sessionId) {
        return failure("invalid_request", "Payload sessionId does not match route param.", 400);
    }

    const result = await run(ingestSnapshot(parsed.data));

    if (!result.ok) {
        if (result.code === "not_found") {
            return failure("not_found", "Session was not found.", 404);
        }

        return failure("invalid_state", "Session is not active.", 409);
    }

    return success({ accepted: true }, 202);
});
