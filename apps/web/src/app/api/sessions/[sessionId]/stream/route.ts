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

export const GET = routeHandler(async (request: Request, context: RouteContext) => {
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

            // Enqueue guarded against a controller closed by an abrupt client
            // disconnect: any throw tears the subscription and interval down
            // instead of leaking them for the life of the process.
            const safeEnqueue = (chunk: string): boolean => {
                try {
                    controller.enqueue(encoder.encode(chunk));
                    return true;
                } catch {
                    cleanup();
                    try {
                        controller.close();
                    } catch {
                        // Already closed — nothing more to do.
                    }
                    return false;
                }
            };

            // Next's cancel() is not always invoked on an abrupt disconnect;
            // the request abort signal is the reliable teardown trigger.
            request.signal.addEventListener("abort", () => {
                cleanup();
                try {
                    controller.close();
                } catch {
                    // Already closed.
                }
            });

            safeEnqueue(encodeSSEData(buildConnectedEvent(sessionId)));

            unsubscribe = await run(
                subscribeToSession(sessionId, (event) => {
                    safeEnqueue(encodeSSEData(event));
                })
            );

            const tick = async () => {
                try {
                    const stale = await Effect.runPromise(
                        isSessionStale(sessionId).pipe(Effect.orElseSucceed(() => true))
                    );
                    if (stale) {
                        safeEnqueue(
                            encodeSSEData({
                                type: "session_ended",
                                sessionId,
                                timestamp: Date.now(),
                            })
                        );
                        cleanup();
                        try {
                            controller.close();
                        } catch {
                            // Already closed.
                        }
                        return;
                    }
                    // Drop the keepalive when the client is not draining (a slow
                    // or stalled reader) so bytes do not buffer unbounded; real
                    // events still flow and session_ended is never dropped.
                    if (controller.desiredSize === null || controller.desiredSize > 0) {
                        safeEnqueue(`: keepalive ${Date.now()}\n\n`);
                    }
                } catch {
                    cleanup();
                    try {
                        controller.close();
                    } catch {
                        // Already closed.
                    }
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
