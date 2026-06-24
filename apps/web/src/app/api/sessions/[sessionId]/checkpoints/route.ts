import { Effect } from "effect";
import { getCheckpoints, getSessionById } from "@spire/server";
import { failure, routeHandler, success } from "@/server/http";
import { run } from "@/server/runtime";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

/** Paginated checkpoint history (newest first). `?before=<seq>&limit=<n>`. */
export const GET = routeHandler(async (request: Request, context: RouteContext) => {
    const { sessionId } = await Promise.resolve(context.params);
    const url = new URL(request.url);

    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw !== null ? Number(limitRaw) : 100;
    const beforeRaw = url.searchParams.get("before");
    const beforeSeq = beforeRaw !== null ? Number(beforeRaw) : undefined;

    const [session, checkpoints] = await run(
        Effect.all(
            [
                getSessionById(sessionId),
                getCheckpoints(sessionId, {
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

    return success({ checkpoints });
});
