"use client";

import type { CheckpointChange } from "@spire/types";
import { useEditorStore } from "@spire/stores/editor-store";
import { useHistoryStore } from "@spire/stores/history-store";
import { useSessionStore } from "@spire/stores/session-store";
import { useCallback, useEffect, useState } from "react";

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

import { CheckpointDiffPane } from "./checkpoint-diff-pane";
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
    const [selectedChange, setSelectedChange] = useState<CheckpointChange | null>(null);

    const title = session?.title ?? "Spire session";
    const description = session?.description ?? null;

    const handleSelectChange = useCallback((change: CheckpointChange | null) => {
        setSelectedChange(change);
    }, []);

    // Auto-select the latest checkpoint when switching to the timeline view.
    useEffect(() => {
        if (view !== "timeline") return;
        const history = useHistoryStore.getState();
        if (history.checkpoints.length === 0 || history.selectedSeq !== null) return;
        const latest = history.checkpoints[0];
        if (!latest) return;
        history.selectSeq(latest.seq);
    }, [view]);

    const handleOpenFile = (path: string) => {
        useEditorStore.getState().openFile(path);
        setView("explorer");
    };

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
                            <HistoryPanel
                                sessionId={sessionId}
                                selectedChange={selectedChange}
                                onSelectChange={handleSelectChange}
                            />
                        )}
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={78}>
                        {view === "timeline" ? (
                            <CheckpointDiffPane
                                sessionId={sessionId}
                                selectedChange={selectedChange}
                            />
                        ) : (
                            <CodeViewer sessionId={sessionId} />
                        )}
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>

            <StatusBar sessionId={sessionId} status={status} />
            <QuickOpen />
        </div>
    );
}
