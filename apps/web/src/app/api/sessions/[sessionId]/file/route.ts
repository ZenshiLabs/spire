import { HASH_RE } from "@spire/types";
import { getFileContent } from "@spire/server";
import { failure, routeHandler, success } from "@/server/http";
import { run } from "@/server/runtime";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

/**
 * Lazy file-content fetch. `ref` is a 64-hex blob hash, the literal "latest",
 * or a checkpoint seq — powering on-demand opens and diff old/new versions.
 */
export const GET = routeHandler(async (request: Request, context: RouteContext) => {
    const { sessionId } = await Promise.resolve(context.params);
    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    const ref = url.searchParams.get("ref") ?? "latest";

    if (!path) {
        return failure("invalid_request", "Missing 'path' query parameter.", 400);
    }

    const result = await run(getFileContent(sessionId, path, ref));
    if (!result) {
        return failure("not_found", "File version was not found.", 404);
    }

    // A concrete blob hash is immutable content — let browsers/CDN cache it
    // forever. "latest"/seq refs can change as the session advances, so they
    // must always revalidate.
    const cacheControl = HASH_RE.test(ref)
        ? "public, max-age=31536000, immutable"
        : "no-store";
    return success(result, 200, { "cache-control": cacheControl });
});
