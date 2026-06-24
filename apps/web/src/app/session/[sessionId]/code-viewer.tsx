"use client";

import { CopyIcon, DownloadIcon, SplitSquareHorizontalIcon, WrapTextIcon } from "lucide-react";
import { useMonaco } from "@monaco-editor/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { CodeBreadcrumbs } from "@/components/code-breadcrumbs";
import { languageForPath } from "@/components/monaco-viewer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { copyText, downloadText } from "@/lib/file-actions";
import { useFileContent } from "@/lib/use-file-content";
import { useEditorStore } from "@spire/stores/editor-store";
import { useFileTreeStore } from "@spire/stores/file-tree-store";
import { Tab } from "./code-viewer-tab";

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
  const setSelectedPath = useFileTreeStore((state) => state.setSelectedPath);
  const meta = useFileTreeStore((state) =>
    activeFilePath ? state.headMeta.get(activeFilePath) : undefined,
  );

  const [diffMode, setDiffMode] = useState(false);
  const [wrap, setWrap] = useState(false);

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
      for (const path of prevTabs.current) {
        if (!tabs.includes(path)) {
          monaco.editor.getModel(monaco.Uri.parse(path))?.dispose();
        }
      }
    }
    prevTabs.current = tabs;
  }, [monaco, tabs]);

  const binary = Boolean(meta?.binary);
  const ref = meta?.hash ?? (activeFilePath ? "latest" : null);
  const current = useFileContent(sessionId, activeFilePath, ref, { binary });
  const baseline = useFileContent(
    sessionId,
    diffMode && activeFilePath && !binary ? activeFilePath : null,
    diffMode && !binary ? "0" : null,
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b">
        <div
          className="flex items-center gap-1 overflow-x-auto px-2 py-1.5"
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
        <div className="flex shrink-0 items-center gap-1 pr-2">
          <Button
            variant={showDiff ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={binary}
            aria-pressed={showDiff}
            onClick={() => setDiffMode((v) => !v)}
            title="Diff against the session's starting version"
          >
            <SplitSquareHorizontalIcon className="size-3.5" />
            Diff
          </Button>
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
              No baseline — this file was added during the session.
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
    </div>
  );
}
