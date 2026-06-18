"use client";

import { useEditorStore } from "@spire/stores/editor-store";
import { useFileTreeStore } from "@spire/stores/file-tree-store";
import {
    ChevronRightIcon,
    CopyIcon,
    DownloadIcon,
    SplitSquareHorizontalIcon,
    WrapTextIcon,
    XIcon,
} from "lucide-react";
import { useMonaco } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

import { FileTypeIcon } from "@/components/file-icon";
import {
    languageForPath,
    MonacoDiffViewer,
    MonacoViewer,
} from "@/components/monaco-viewer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { baseName } from "@/lib/change-meta";
import { copyText, downloadText } from "@/lib/file-actions";
import { useFileContent } from "@/lib/use-file-content";
import { cn } from "@/lib/utils";

function Breadcrumbs({ path }: { path: string }) {
    const segments = path.split("/");
    return (
        <div className="text-muted-foreground flex min-w-0 items-center gap-1 overflow-x-auto px-3 py-1 text-xs">
            {segments.map((segment, index) => (
                <span key={index} className="flex shrink-0 items-center gap-1">
                    {index > 0 && <ChevronRightIcon className="size-3" />}
                    <span className={cn(index === segments.length - 1 && "text-foreground")}>
                        {segment}
                    </span>
                </span>
            ))}
        </div>
    );
}

export function CodeViewer({ sessionId }: { sessionId: string }) {
    const tabs = useEditorStore((state) => state.tabs);
    const activeFilePath = useEditorStore((state) => state.activeFilePath);
    const setActiveFile = useEditorStore((state) => state.setActiveFile);
    const closeFile = useEditorStore((state) => state.closeFile);
    const setSelectedPath = useFileTreeStore((state) => state.setSelectedPath);
    const meta = useFileTreeStore((state) =>
        activeFilePath ? state.headMeta.get(activeFilePath) : undefined
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
        diffMode && !binary ? "0" : null
    );

    if (!activeFilePath) {
        return (
            <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-center text-sm">
                Select a file from the Explorer to follow along.
            </div>
        );
    }

    const content = current.content ?? "";
    const language = languageForPath(activeFilePath);
    const lineCount = content ? content.split("\n").length : 0;
    const showDiff = diffMode && !binary && baseline.content !== null;

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 border-b">
                <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5" role="tablist">
                    {tabs.map((path) => {
                        const active = path === activeFilePath;
                        return (
                            <div
                                key={path}
                                role="tab"
                                aria-selected={active}
                                className={cn(
                                    "group flex items-center gap-1.5 rounded-md py-1 pr-1 pl-2.5 text-xs transition-colors",
                                    active
                                        ? "bg-accent text-accent-foreground"
                                        : "text-muted-foreground hover:bg-accent/50"
                                )}
                            >
                                <button
                                    type="button"
                                    className="flex items-center gap-1.5 font-mono whitespace-nowrap"
                                    onClick={() => {
                                        setActiveFile(path);
                                        setSelectedPath(path);
                                    }}
                                >
                                    <FileTypeIcon kind="file" name={baseName(path)} className="size-3.5" />
                                    {baseName(path)}
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Close ${baseName(path)}`}
                                    className="hover:bg-background/80 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                                    onClick={() => closeFile(path)}
                                >
                                    <XIcon className="size-3" />
                                </button>
                            </div>
                        );
                    })}
                </div>
                <div className="flex shrink-0 items-center gap-1 pr-2">
                    <Button
                        type="button"
                        variant={showDiff ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        disabled={binary}
                        aria-pressed={showDiff}
                        onClick={() => setDiffMode((value) => !value)}
                        title="Diff against the session's starting version"
                    >
                        <SplitSquareHorizontalIcon className="size-3.5" />
                        Diff
                    </Button>
                    <Button
                        type="button"
                        variant={wrap ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 w-7 p-0"
                        aria-pressed={wrap}
                        onClick={() => setWrap((value) => !value)}
                        title="Toggle word wrap"
                    >
                        <WrapTextIcon className="size-3.5" />
                    </Button>
                    <Button
                        type="button"
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
                        type="button"
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

            <Breadcrumbs path={activeFilePath} />

            <div className="min-h-0 flex-1 border-t">
                {binary ? (
                    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-1 p-6 text-center text-sm">
                        <span>Binary file — contents are not shown.</span>
                        {meta?.hash && (
                            <span className="text-xs">This file is tracked but its bytes are not stored.</span>
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
