import { failure } from "../../../_lib/http";
import {
    buildConnectedEvent,
    getSessionById,
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

            heartbeat = setInterval(() => {
                controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
            }, 15000);

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
