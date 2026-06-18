"use client";

import { useEditorStore } from "@spire/stores/editor-store";
import { useSessionStore } from "@spire/stores/session-store";

import { cn } from "@/lib/utils";
import type { StreamStatus } from "@/lib/use-session-stream";

const STATUS_LABELS: Record<StreamStatus, string> = {
    connecting: "Connecting",
    live: "Live",
    ended: "Ended",
    error: "Disconnected",
};

const STATUS_DOT: Record<StreamStatus, string> = {
    connecting: "bg-amber-500",
    live: "bg-emerald-500",
    ended: "bg-muted-foreground",
    error: "bg-destructive",
};

export function StatusBar({
    sessionId,
    status,
}: {
    sessionId: string;
    status: StreamStatus;
}) {
    const activeFilePath = useEditorStore((state) => state.activeFilePath);
    const loadMode = useSessionStore((state) => state.loadMode);

    return (
        <footer className="bg-sidebar text-muted-foreground flex h-6 shrink-0 items-center justify-between gap-4 border-t px-3 text-[11px]">
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex items-center gap-1.5">
                    <span
                        className={cn(
                            "size-2 rounded-full",
                            STATUS_DOT[status],
                            status === "live" && "animate-pulse"
                        )}
                    />
                    {STATUS_LABELS[status]}
                </span>
                <span className="font-mono">{sessionId}</span>
            </div>
            <div className="flex min-w-0 items-center gap-3">
                {activeFilePath && (
                    <span className="truncate font-mono">{activeFilePath}</span>
                )}
                <span className="uppercase">{loadMode}</span>
            </div>
        </footer>
    );
}
