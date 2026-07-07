import { Effect } from "effect";
import { getFileHistory, getSessionById } from "@spire/server";
import { failure, routeHandler, success } from "@/server/http";
import { run } from "@/server/runtime";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

/**
 * Per-file revision history: every checkpoint that touched `path`, newest
 * first. `?path=<file>&before=<seq>&limit=<n>`. Powers the per-file timeline
 * sheet in the viewer, where a revision can be picked as a diff baseline.
 */
export const GET = routeHandler(async (request: Request, context: RouteContext) => {
    const { sessionId } = await Promise.resolve(context.params);
    const url = new URL(request.url);

    const path = url.searchParams.get("path");
    if (!path) {
        return failure("invalid_request", "Missing 'path' query parameter.", 400);
    }

    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw !== null ? Number(limitRaw) : 100;
    const beforeRaw = url.searchParams.get("before");
    const beforeSeq = beforeRaw !== null ? Number(beforeRaw) : undefined;

    const [session, history] = await run(
        Effect.all(
            [
                getSessionById(sessionId),
                getFileHistory(sessionId, path, {
                    limit: Number.isFinite(limit) ? limit : 100,
                    beforeSeq:
                        beforeSeq !== undefined && Number.isFinite(beforeSeq)
                            ? beforeSeq
                            : undefined,
                }),
            ],
            { concurrency: "unbounded" }
        )
    );

    if (!session) {
        return failure("not_found", "Session was not found.", 404);
    }

    return success({ history });
});
