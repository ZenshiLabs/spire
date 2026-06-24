import { Effect } from "effect";
import {
    buildConnectedEvent,
    getSessionById,
    isSessionStale,
    subscribeToSession,
} from "@spire/server";
import type { SSEEvent } from "@spire/types";
import { failure, routeHandler } from "@/server/http";
import { run } from "@/server/runtime";

/**
 * The SSE stream is long-lived and holds a per-instance subscriber, so it must
 * run on the Node runtime and never be statically optimised or cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
    params: { sessionId: string } | Promise<{ sessionId: string }>;
};

function encodeSSEData(event: SSEEvent) {
    return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export const GET = routeHandler(async (_request: Request, context: RouteContext) => {
    const { sessionId } = await Promise.resolve(context.params);
    const session = await run(getSessionById(sessionId));

    if (!session) {
        return failure("not_found", "Session was not found.", 404);
    }

    let unsubscribe: (() => void) | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
        if (heartbeat) {
            clearInterval(heartbeat);
            heartbeat = null;
        }

        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
    };

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(encodeSSEData(buildConnectedEvent(sessionId))));

            unsubscribe = await run(
                subscribeToSession(sessionId, (event) => {
                    controller.enqueue(encoder.encode(encodeSSEData(event)));
                })
            );

            const tick = async () => {
                try {
                    const stale = await Effect.runPromise(
                        isSessionStale(sessionId).pipe(Effect.orElseSucceed(() => true))
                    );
                    if (stale) {
                        controller.enqueue(
                            encoder.encode(
                                encodeSSEData({
                                    type: "session_ended",
                                    sessionId,
                                    timestamp: Date.now(),
                                })
                            )
                        );
                        cleanup();
                        controller.close();
                        return;
                    }
                    controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
                } catch {
                    cleanup();
                }
            };

            heartbeat = setInterval(() => void tick(), 15000);

            if (session.status !== "active") {
                cleanup();
                controller.close();
            }
        },
        cancel() {
            cleanup();
        },
    });

    return new Response(stream, {
        headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
        },
    });
});
