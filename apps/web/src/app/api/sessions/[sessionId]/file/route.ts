import { failure, success } from "../../../_lib/http";
import { getFileContent } from "../../../_lib/state";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

/**
 * Lazy file-content fetch. `ref` is a 64-hex blob hash, the literal "latest",
 * or a checkpoint seq — powering on-demand opens and diff old/new versions.
 */
export async function GET(request: Request, context: RouteContext) {
    const { sessionId } = await Promise.resolve(context.params);
    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    const ref = url.searchParams.get("ref") ?? "latest";

    if (!path) {
        return failure("invalid_request", "Missing 'path' query parameter.", 400);
    }

    const result = await getFileContent(sessionId, path, ref);
    if (!result) {
        return failure("not_found", "File version was not found.", 404);
    }

    return success(result);
}
