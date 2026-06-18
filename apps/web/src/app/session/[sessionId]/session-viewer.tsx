"use client";

import { useSessionStore } from "@spire/stores/session-store";
import { useState } from "react";

import { ActivityBar, type ActivityView } from "@/components/activity-bar";
import { QuickOpen } from "@/components/quick-open";
import { StatusBar } from "@/components/status-bar";
import { ThemePicker } from "@/components/theme-picker";
import { Badge } from "@/components/ui/badge";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { useSessionStream, type StreamStatus } from "@/lib/use-session-stream";

import { CodeViewer } from "./code-viewer";
import { FileTree } from "./file-tree";
import { HistoryPanel } from "./history-panel";

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

export function SessionViewer({ sessionId }: { sessionId: string }) {
    const { status, error } = useSessionStream(sessionId);
    const session = useSessionStore((state) => state.session);
    const [view, setView] = useState<ActivityView>("explorer");

    const title = session?.title ?? "Spire session";
    const description = session?.description ?? null;

    return (
        <div className="flex h-svh flex-col">
            <header className="flex items-center justify-between gap-4 border-b px-4 py-2.5">
                <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{title}</span>
                    {description && (
                        <span className="text-muted-foreground truncate text-xs">
                            {description}
                        </span>
                    )}
                </div>
                <div className="flex flex-shrink-0 items-center gap-3">
                    <Badge variant="secondary" className="font-mono">
                        {sessionId}
                    </Badge>
                    <span className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                        <span
                            className={cn(
                                "size-2 rounded-full",
                                STATUS_DOT[status],
                                status === "live" && "animate-pulse"
                            )}
                        />
                        {STATUS_LABELS[status]}
                    </span>
                    <ThemePicker />
                </div>
            </header>

            {status === "ended" && (
                <div className="bg-muted text-muted-foreground border-b px-4 py-1.5 text-center text-xs">
                    This session has ended. You are viewing the final state.
                </div>
            )}
            {status === "error" && (
                <div className="bg-destructive/10 text-destructive border-b px-4 py-1.5 text-center text-xs">
                    {error ?? "Lost connection to the session."}
                </div>
            )}

            <div className="flex min-h-0 flex-1">
                <ActivityBar view={view} onChange={setView} />
                <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
                    <ResizablePanel
                        defaultSize={22}
                        minSize={14}
                        maxSize={40}
                        className="bg-sidebar text-sidebar-foreground"
                    >
                        {view === "explorer" ? (
                            <FileTree
                                sessionId={sessionId}
                                onOpenTimeline={() => setView("timeline")}
                            />
                        ) : (
                            <HistoryPanel sessionId={sessionId} />
                        )}
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={78}>
                        <CodeViewer sessionId={sessionId} />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>

            <StatusBar sessionId={sessionId} status={status} />
            <QuickOpen />
        </div>
    );
}
