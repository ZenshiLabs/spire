import type { Metadata } from "next";

import { SessionViewer } from "./session-viewer";

/**
 * Sessions are ephemeral and unguessable, so keep them out of search indexes:
 * indexing leaks nothing useful and pollutes results with dead session URLs.
 */
export async function generateMetadata({
    params,
}: {
    params: Promise<{ sessionId: string }>;
}): Promise<Metadata> {
    const { sessionId } = await params;
    return {
        title: `Session ${sessionId}`,
        robots: { index: false, follow: false },
    };
}

export default async function SessionPage({
    params,
}: {
    params: Promise<{ sessionId: string }>;
}) {
    const { sessionId } = await params;
    return <SessionViewer sessionId={sessionId} />;
}
