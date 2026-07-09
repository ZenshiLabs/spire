"use client";

import type { CheckpointChange } from "@spire/types";
import { useEditorStore } from "@spire/stores/editor-store";
import { useHistoryStore } from "@spire/stores/history-store";
import { useSessionStore } from "@spire/stores/session-store";
import { CheckIcon, LinkIcon, PanelLeftIcon, RotateCwIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";

import { ActivityBar, type ActivityView } from "@/components/activity-bar";
import { QuickOpen } from "@/components/quick-open";
import { StatusBar } from "@/components/status-bar";
import { ThemePicker } from "@/components/theme-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  useSessionStream,
  STATUS_LABELS,
  STATUS_DOT,
} from "@/lib/use-session-stream";

/** Header button that copies the current session URL, with brief inline feedback. */
function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        // Clipboard blocked (e.g. insecure context) — leave state unchanged.
      });
  }, []);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 gap-1.5 px-2 text-xs"
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-emerald-500" />
          ) : (
            <LinkIcon className="size-3.5" />
          )}
          <span className="hidden sm:inline">
            {copied ? "Copied" : "Copy link"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>Copy this session&apos;s share link</TooltipContent>
    </Tooltip>
  );
}

/** Placeholder layout shown while the initial session state is loading. */
function ViewerSkeleton() {
  return (
    <div className="flex min-h-0 flex-1">
      <div className="bg-sidebar w-64 shrink-0 space-y-2 border-r p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-4"
            style={{ width: `${60 + ((i * 7) % 35)}%` }}
          />
        ))}
      </div>
      <div className="flex-1 space-y-3 p-4">
        <Skeleton className="h-5 w-1/3" />
        {Array.from({ length: 14 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-3.5"
            style={{ width: `${40 + ((i * 13) % 55)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

import { CheckpointDiffPane } from "./checkpoint-diff-pane";
import { CodeViewer } from "./code-viewer";
import { FileTree } from "./file-tree";
import { HistoryPanel } from "./history-panel";

/**
 * `embed` renders the viewer for an `<iframe>` on the landing page: the
 * "session ended" notice is suppressed, because the surrounding page already
 * says what this is and its "Back home" link would strand the reader inside a
 * frame. Nothing else changes, so the preview is the real viewer.
 */
export function SessionViewer({
  sessionId,
  embed = false,
}: {
  sessionId: string;
  embed?: boolean;
}) {
  const { status, error, retry } = useSessionStream(sessionId);
  const session = useSessionStore((state) => state.session);
  const isMobile = useIsMobile();
  const [view, setView] = useState<ActivityView>("explorer");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedChange, setSelectedChange] = useState<CheckpointChange | null>(
    null,
  );
  const sidebarRef = useRef<ImperativePanelHandle>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const activeFilePath = useEditorStore((state) => state.activeFilePath);

  const toggleSidebar = useCallback(() => {
    const panel = sidebarRef.current;
    if (!panel) {
      return;
    }
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, []);

  // On mobile the tree/timeline live in a Sheet; opening a file should reveal
  // the editor, so close the Sheet whenever the active file changes.
  useEffect(() => {
    if (activeFilePath) {
      setSheetOpen(false);
    }
  }, [activeFilePath]);

  const title = session?.title ?? "Spire session";
  const description = session?.description ?? null;

  const handleSelectChange = useCallback((change: CheckpointChange | null) => {
    setSelectedChange(change);
  }, []);

  const handleOpenTimeline = useCallback(() => {
    setView("timeline");
  }, []);

  const handleViewChange = useCallback(
    (next: ActivityView) => {
      if (isMobile) {
        // On mobile the panels live in a Sheet; surface it when the rail is used.
        setView(next);
        setSheetOpen(true);
      } else if (next === view) {
        // Re-clicking the active view toggles the sidebar, VS Code-style.
        toggleSidebar();
      } else {
        setView(next);
        sidebarRef.current?.expand();
      }
      if (next === "timeline") {
        const history = useHistoryStore.getState();
        if (history.checkpoints.length > 0 && history.selectedSeq === null) {
          const latest = history.checkpoints[0];
          if (latest) {
            history.selectSeq(latest.seq);
          }
        }
      }
    },
    [isMobile, view, toggleSidebar],
  );

  return (
    <div className="flex h-svh flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() =>
                  isMobile ? setSheetOpen(true) : toggleSidebar()
                }
                aria-label={
                  isMobile
                    ? "Open file explorer"
                    : sidebarCollapsed
                      ? "Show sidebar"
                      : "Hide sidebar"
                }
                aria-pressed={!isMobile && !sidebarCollapsed}
              >
                <PanelLeftIcon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isMobile
                ? "Open file explorer"
                : sidebarCollapsed
                  ? "Show sidebar"
                  : "Hide sidebar"}
            </TooltipContent>
          </Tooltip>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{title}</span>
            {description && (
              <span className="text-muted-foreground truncate text-xs">
                {description}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
          <CopyLinkButton />
          <Badge
            variant="secondary"
            className="hidden font-mono sm:inline-flex"
          >
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

      {status === "ended" && !embed && (
        <Alert className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-none border-x-0 border-t-0 py-1.5 text-center text-xs">
          <AlertDescription>
            This session has ended, so you&apos;re viewing its final state.
          </AlertDescription>
          <span className="flex items-center gap-2">
            <Button asChild size="sm" variant="default" className="h-6 px-2 text-xs">
              <Link href="/docs#getting-started">Start your own session</Link>
            </Button>
            <Button asChild size="sm" variant="ghost" className="h-6 px-2 text-xs">
              <Link href="/">Back home</Link>
            </Button>
          </span>
        </Alert>
      )}
      {status === "error" && (
        <Alert
          variant="destructive"
          className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-none border-x-0 border-t-0 py-1.5 text-center text-xs"
        >
          <AlertDescription>
            {error ?? "Lost connection to the session."}
          </AlertDescription>
          <Button
            size="sm"
            variant="outline"
            onClick={retry}
            className="h-6 gap-1.5 px-2 text-xs"
          >
            <RotateCwIcon className="size-3" />
            Retry
          </Button>
        </Alert>
      )}

      {(() => {
        if (status === "connecting" && !session) {
          return <ViewerSkeleton />;
        }

        const sidePanel =
          view === "explorer" ? (
            <FileTree
              sessionId={sessionId}
              onOpenTimeline={handleOpenTimeline}
            />
          ) : (
            <HistoryPanel
              sessionId={sessionId}
              selectedChange={selectedChange}
              onSelectChange={handleSelectChange}
            />
          );

        const mainContent =
          view === "timeline" ? (
            <CheckpointDiffPane
              sessionId={sessionId}
              selectedChange={selectedChange}
            />
          ) : (
            <CodeViewer sessionId={sessionId} />
          );

        if (isMobile) {
          return (
            <div className="flex min-h-0 flex-1">
              <ActivityBar view={view} onChange={handleViewChange} />
              <div className="min-w-0 flex-1">{mainContent}</div>
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent
                  side="left"
                  className="bg-sidebar text-sidebar-foreground w-[85vw] max-w-sm p-0"
                >
                  <SheetTitle className="px-3 pt-3 text-xs font-medium tracking-wide uppercase">
                    {view === "explorer" ? "Explorer" : "Timeline"}
                  </SheetTitle>
                  <div className="min-h-0 flex-1 overflow-hidden">{sidePanel}</div>
                </SheetContent>
              </Sheet>
            </div>
          );
        }

        return (
          <div className="flex min-h-0 flex-1">
            {!sidebarCollapsed && (
              <ActivityBar view={view} onChange={handleViewChange} />
            )}
            <ResizablePanelGroup direction="horizontal" className="min-h-0 flex-1">
              <ResizablePanel
                ref={sidebarRef}
                defaultSize={22}
                minSize={14}
                maxSize={40}
                collapsible
                collapsedSize={0}
                onCollapse={() => setSidebarCollapsed(true)}
                onExpand={() => setSidebarCollapsed(false)}
                className="bg-sidebar text-sidebar-foreground min-w-0"
              >
                {sidePanel}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={78}>{mainContent}</ResizablePanel>
            </ResizablePanelGroup>
          </div>
        );
      })()}

      <StatusBar sessionId={sessionId} status={status} />
      <QuickOpen />
    </div>
  );
}
