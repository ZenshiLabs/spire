import { getSessionManifest } from "@spire/server";
import { failure, routeHandler, success } from "@/server/http";
import { run } from "@/server/runtime";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

/**
 * Current head-file manifest (path + hash per file, no content). The CLI fetches
 * this on rejoin to diff local files against the server and upload only what
 * changed, avoiding a full snapshot re-upload. Always revalidate — the manifest
 * advances with every checkpoint.
 */
export const GET = routeHandler(async (_request: Request, context: RouteContext) => {
    const { sessionId } = await Promise.resolve(context.params);
    const manifest = await run(getSessionManifest(sessionId));

    if (!manifest) {
        return failure("not_found", "Session was not found.", 404);
    }

    return success(manifest, 200, { "cache-control": "no-store" });
});
