import { failure } from "../../../_lib/http";
import {
    buildConnectedEvent,
    getSessionById,
    isSessionStale,
    subscribeToSession,
} from "../../../_lib/state";
import type { SSEEvent } from "@spire/types";

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

export async function GET(_request: Request, context: RouteContext) {
    const { sessionId } = await Promise.resolve(context.params);
    const session = await getSessionById(sessionId);

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
        start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(encodeSSEData(buildConnectedEvent(sessionId))));

            /**
             * The initial snapshot, content, and checkpoint history are served by the
             * sibling `/state` endpoint. This stream carries only live events emitted
             * after the viewer has already loaded that initial payload.
             */
            unsubscribe = subscribeToSession(sessionId, (event) => {
                controller.enqueue(encoder.encode(encodeSSEData(event)));
            });

            /**
             * Keepalive doubles as a liveness probe. A clean `spire stop` already
             * fans out a `session_ended` event, but an abrupt CLI exit (closed
             * terminal, crash, lost network) sends nothing — so on each tick we
             * also check whether the broadcast has gone stale and, if so, tell
             * this already-connected viewer the session ended and close.
             */
            const tick = async () => {
                try {
                    if (await isSessionStale(sessionId)) {
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
                    controller.enqueue(
                        encoder.encode(`: keepalive ${Date.now()}\n\n`)
                    );
                } catch {
                    // The stream was already torn down (viewer disconnected).
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
}
