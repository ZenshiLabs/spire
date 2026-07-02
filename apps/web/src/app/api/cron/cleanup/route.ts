import { cleanupSessions } from "@spire/server";
import { failure, routeHandler, success } from "@/server/http";
import { run } from "@/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Active sessions idle longer than this are marked ended (CLI died uncleanly). */
const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;

/** Ended sessions older than this many days are deleted (cascades to all data). */
const RETENTION_DAYS = Number(process.env.SPIRE_RETENTION_DAYS) || 30;

/**
 * Scheduled retention sweep, invoked by Vercel Cron (see vercel.json) or any
 * external scheduler. Protected by a bearer secret so it cannot be triggered by
 * arbitrary callers. Self-hosters without Vercel Cron can curl this on a
 * schedule with the same header.
 */
export const GET = routeHandler(async (request: Request) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        return failure("not_configured", "CRON_SECRET is not set.", 503);
    }
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
        return failure("unauthorized", "Invalid cron credentials.", 401);
    }

    const now = Date.now();
    const idleCutoff = new Date(now - ABANDON_AFTER_MS);
    const expiryCutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const result = await run(cleanupSessions(idleCutoff, expiryCutoff));
    return success(result);
});
