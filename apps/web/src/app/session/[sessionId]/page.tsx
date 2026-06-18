import { SessionViewer } from "./session-viewer";

export default async function SessionPage({
    params,
}: {
    params: Promise<{ sessionId: string }>;
}) {
    const { sessionId } = await params;
    return <SessionViewer sessionId={sessionId} />;
}
