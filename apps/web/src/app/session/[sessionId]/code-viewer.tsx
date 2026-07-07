"use client";

import {
  CopyIcon,
  DownloadIcon,
  HistoryIcon,
  ListXIcon,
  SplitSquareHorizontalIcon,
  WrapTextIcon,
} from "lucide-react";
import { useMonaco } from "@monaco-editor/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { CodeBreadcrumbs } from "@/components/code-breadcrumbs";
import { languageForPath } from "@/components/monaco-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { copyText, downloadText } from "@/lib/file-actions";
import { useFileContent } from "@/lib/use-file-content";
import { useFileRevisionCount } from "@/lib/use-file-revision-count";
import { useEditorStore } from "@spire/stores/editor-store";
import { useFileTreeStore } from "@spire/stores/file-tree-store";
import { Tab } from "./code-viewer-tab";
import { FileHistorySheet, SESSION_START_REF } from "./file-history-sheet";

const MonacoViewer = dynamic(
  () => import("@/components/monaco-viewer").then((m) => m.MonacoViewer),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> }
);

const MonacoDiffViewer = dynamic(
  () => import("@/components/monaco-viewer").then((m) => m.MonacoDiffViewer),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> }
);

export function CodeViewer({ sessionId }: { sessionId: string }) {
  const tabs = useEditorStore((state) => state.tabs);
  const activeFilePath = useEditorStore((state) => state.activeFilePath);
  const setActiveFile = useEditorStore((state) => state.setActiveFile);
  const closeFile = useEditorStore((state) => state.closeFile);
  const clearAll = useEditorStore((state) => state.clearAll);
  const setSelectedPath = useFileTreeStore((state) => state.setSelectedPath);
  const meta = useFileTreeStore((state) =>
    activeFilePath ? state.headMeta.get(activeFilePath) : undefined,
  );

  const [diffMode, setDiffMode] = useState(false);
  const [diffBase, setDiffBase] = useState(SESSION_START_REF);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [wrap, setWrap] = useState(false);

  // A revision picked in the history sheet belongs to one file's timeline;
  // fall back to the session-start baseline when the active file changes.
  useEffect(() => {
    setDiffBase(SESSION_START_REF);
  }, [activeFilePath]);

  /**
   * Dispose Monaco models for tabs that were closed since the last render.
   * Without this, models accumulate over a long session and leak memory.
   * Matching is done by path URI so that diff-editor models, which use
   * synthetic generated URIs, are never accidentally disposed here.
   */
  const monaco = useMonaco();
  const prevTabs = useRef<string[]>([]);
  useEffect(() => {
    if (monaco) {
      const current = new Set(tabs);
      for (const path of prevTabs.current) {
        if (!current.has(path)) {
          monaco.editor.getModel(monaco.Uri.parse(path))?.dispose();
        }
      }
    }
    prevTabs.current = tabs;
  }, [monaco, tabs]);

  const binary = Boolean(meta?.binary);
  const revisionCount = useFileRevisionCount(
    sessionId,
    activeFilePath,
    meta?.hash ?? null,
  );
  const ref = meta?.hash ?? (activeFilePath ? "latest" : null);
  const current = useFileContent(sessionId, activeFilePath, ref, { binary });
  const baseline = useFileContent(
    sessionId,
    diffMode && activeFilePath && !binary ? activeFilePath : null,
    diffMode && !binary ? diffBase : null,
  );

  const content = current.content ?? "";
  const lineCount = content ? content.split("\n").length : 0;

  if (!activeFilePath) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-center text-sm">
        Select a file from the Explorer to follow along.
      </div>
    );
  }

  const language = languageForPath(activeFilePath);
  const showDiff = diffMode && !binary && baseline.content !== null;
  const diffBaseLabel =
    diffBase === SESSION_START_REF ? "start" : `#${diffBase}`;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b">
        <ScrollArea className="min-w-0 flex-1">
          <div
            className="flex w-max items-center gap-1 px-2 py-1.5"
            role="tablist"
          >
            {tabs.map((path) => (
              <Tab
                key={path}
                path={path}
                active={path === activeFilePath}
                setActiveFile={setActiveFile}
                setSelectedPath={setSelectedPath}
                closeFile={closeFile}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="h-1.5" />
        </ScrollArea>
        <div className="flex shrink-0 items-center gap-1 pr-2">
          <Button
            variant={diffMode && !binary ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={binary}
            aria-pressed={diffMode && !binary}
            onClick={() => setDiffMode((v) => !v)}
            title={
              diffBase === SESSION_START_REF
                ? "Diff against the session's starting version"
                : `Diff against revision #${diffBase}`
            }
          >
            <SplitSquareHorizontalIcon className="size-3.5" />
            Diff
            {diffMode && !binary && (
              <span className="text-muted-foreground font-mono text-[10px]">
                vs {diffBaseLabel}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="relative h-7 w-7 p-0"
            aria-label={
              revisionCount !== null && revisionCount > 0
                ? `File timeline (${revisionCount} revision${revisionCount === 1 ? "" : "s"})`
                : "File timeline"
            }
            onClick={() => setHistoryOpen(true)}
            title="File timeline — pick a revision to diff against"
          >
            <HistoryIcon className="size-3.5" />
            {revisionCount !== null && revisionCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-3.5 min-w-3.5 rounded-full px-1 text-[9px]"
                aria-hidden="true"
              >
                {revisionCount > 99 ? "99+" : revisionCount}
              </Badge>
            )}
          </Button>
          <Separator orientation="vertical" className="mx-0.5 !h-4" />
          <Button
            variant={wrap ? "secondary" : "ghost"}
            size="sm"
            className="h-7 w-7 p-0"
            aria-pressed={wrap}
            onClick={() => setWrap((v) => !v)}
            title="Toggle word wrap"
          >
            <WrapTextIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={binary || !content}
            onClick={() => void copyText(content)}
            title="Copy file contents"
          >
            <CopyIcon className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={binary || !content}
            onClick={() => downloadText(activeFilePath, content)}
            title="Download file"
          >
            <DownloadIcon className="size-3.5" />
          </Button>
          <Separator orientation="vertical" className="mx-0.5 !h-4" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            aria-label="Close all files"
            onClick={() => {
              clearAll();
              setSelectedPath(null);
            }}
            title="Close all files"
          >
            <ListXIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      <CodeBreadcrumbs path={activeFilePath} />

      <div className="min-h-0 flex-1 border-t">
        {binary ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-1 p-6 text-center text-sm">
            <span>Binary file — contents are not shown.</span>
            {meta?.hash && (
              <span className="text-xs">
                This file is tracked but its bytes are not stored.
              </span>
            )}
          </div>
        ) : current.loading ? (
          <Skeleton className="size-full rounded-none" />
        ) : current.error ? (
          <div className="text-destructive flex h-full items-center justify-center p-6 text-center text-sm">
            {current.error}
          </div>
        ) : showDiff ? (
          baseline.loading ? (
            <Skeleton className="size-full rounded-none" />
          ) : baseline.content === null ? (
            <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-center text-sm">
              No baseline — this file did not exist at{" "}
              {diffBase === SESSION_START_REF
                ? "the session start"
                : `revision #${diffBase}`}
              .
            </div>
          ) : (
            <MonacoDiffViewer
              path={activeFilePath}
              original={baseline.content}
              modified={content}
            />
          )
        ) : (
          <MonacoViewer
            path={activeFilePath}
            value={content}
            wordWrap={wrap ? "on" : "off"}
          />
        )}
      </div>

      <div className="text-muted-foreground bg-sidebar flex h-6 shrink-0 items-center justify-end gap-4 border-t px-3 text-[11px]">
        {!binary && <span>{lineCount} lines</span>}
        <span className="uppercase">{language}</span>
      </div>

      <FileHistorySheet
        sessionId={sessionId}
        path={activeFilePath}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        diffBase={diffMode && !binary ? diffBase : null}
        onSelectBase={(ref) => {
          setDiffBase(ref);
          setDiffMode(true);
          setHistoryOpen(false);
        }}
      />
    </div>
  );
}
