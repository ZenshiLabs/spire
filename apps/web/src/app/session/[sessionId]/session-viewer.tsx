"use client";

import type { CheckpointChange } from "@spire/types";
import { useHistoryStore } from "@spire/stores/history-store";
import { useSessionStore } from "@spire/stores/session-store";
import { useCallback, useState } from "react";

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  useSessionStream,
  STATUS_LABELS,
  STATUS_DOT,
} from "@/lib/use-session-stream";

import { CheckpointDiffPane } from "./checkpoint-diff-pane";
import { CodeViewer } from "./code-viewer";
import { FileTree } from "./file-tree";
import { HistoryPanel } from "./history-panel";

export function SessionViewer({ sessionId }: { sessionId: string }) {
  const { status, error } = useSessionStream(sessionId);
  const session = useSessionStore((state) => state.session);
  const [view, setView] = useState<ActivityView>("explorer");
  const [selectedChange, setSelectedChange] = useState<CheckpointChange | null>(
    null,
  );

  const title = session?.title ?? "Spire session";
  const description = session?.description ?? null;

  const handleSelectChange = useCallback((change: CheckpointChange | null) => {
    setSelectedChange(change);
  }, []);

  const handleViewChange = useCallback((next: ActivityView) => {
    setView(next);
    if (next === "timeline") {
      const history = useHistoryStore.getState();
      if (history.checkpoints.length > 0 && history.selectedSeq === null) {
        const latest = history.checkpoints[0];
        if (latest) {
          history.selectSeq(latest.seq);
        }
      }
    }
  }, []);

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
                status === "live" && "animate-pulse",
              )}
            />
            {STATUS_LABELS[status]}
          </span>
          <ThemePicker />
        </div>
      </header>

      {status === "ended" && (
        <Alert className="rounded-none border-x-0 border-t-0 py-1.5 text-center text-xs">
          <AlertDescription>
            This session has ended. You are viewing the final state.
          </AlertDescription>
        </Alert>
      )}
      {status === "error" && (
        <Alert
          variant="destructive"
          className="rounded-none border-x-0 border-t-0 py-1.5 text-center text-xs"
        >
          <AlertDescription>
            {error ?? "Lost connection to the session."}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex min-h-0 flex-1">
        <ActivityBar view={view} onChange={handleViewChange} />
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
