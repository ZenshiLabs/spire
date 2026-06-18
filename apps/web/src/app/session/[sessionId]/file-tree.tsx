"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import type { FileNode } from "@spire/types";
import { useEditorStore } from "@spire/stores/editor-store";
import { useFileTreeStore } from "@spire/stores/file-tree-store";
import { ChevronRight, ClockIcon, CopyIcon, DownloadIcon } from "lucide-react";
import { useRef } from "react";

import { FileTypeIcon } from "@/components/file-icon";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { CHANGE_META } from "@/lib/change-meta";
import { copyText, downloadText } from "@/lib/file-actions";
import { fetchFileContent } from "@/lib/session-api";
import { prefetchFileContent } from "@/lib/use-file-content";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 24;

/** Resolve a file's current content (cache-first) for an action. */
async function withContent(
    sessionId: string,
    path: string,
    action: (content: string) => void
) {
    const meta = useFileTreeStore.getState().headMeta.get(path);
    const ref = meta?.hash ?? "latest";
    try {
        const result = await fetchFileContent(sessionId, path, ref);
        action(result.content);
    } catch {
        /**
         * Fetch failures are silently discarded. The file may have been deleted
         * between the hover event and the fetch resolving, which is a normal
         * race condition in a live session.
         */
    }
}

function DirectoryRow({
    node,
    depth,
    expanded,
    onToggle,
}: {
    node: FileNode;
    depth: number;
    expanded: boolean;
    onToggle: () => void;
}) {
    const indent = { paddingLeft: `${depth * 12 + 6}px` };

    if (node.type === "directory" && node.ignored) {
        return (
            <div
                className="text-muted-foreground/60 flex h-full items-center gap-1.5 pr-2 text-sm italic"
                style={indent}
                title="Contents hidden (build output)"
            >
                <span className="size-3.5 shrink-0" />
                <FileTypeIcon kind="directory" name={node.name} className="size-4 opacity-60" />
                <span className="truncate">{node.name}</span>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="hover:bg-sidebar-accent flex h-full w-full items-center gap-1.5 pr-2 text-sm"
            style={indent}
        >
            <ChevronRight
                className={cn(
                    "text-muted-foreground size-3.5 shrink-0 transition-transform",
                    expanded && "rotate-90"
                )}
            />
            <FileTypeIcon
                kind="directory"
                name={node.name}
                expanded={expanded}
                className="size-4"
            />
            <span className="truncate">{node.name}</span>
        </button>
    );
}

function FileRow({
    node,
    depth,
    sessionId,
    active,
    onOpenTimeline,
}: {
    node: Extract<FileNode, { type: "file" }>;
    depth: number;
    sessionId: string;
    active: boolean;
    onOpenTimeline: (path: string) => void;
}) {
    const openFile = useEditorStore((state) => state.openFile);
    const setSelectedPath = useFileTreeStore((state) => state.setSelectedPath);
    const decoration = useFileTreeStore((state) => state.decorations.get(node.path));
    const indent = { paddingLeft: `${depth * 12 + 6}px` };
    const meta = CHANGE_META[decoration ?? "modified"];

    const open = () => {
        openFile(node.path);
        setSelectedPath(node.path);
    };

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div
                    className={cn(
                        "group flex h-full items-center gap-1.5 pr-1 text-sm",
                        active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "hover:bg-sidebar-accent/60"
                    )}
                    style={indent}
                    onMouseEnter={() => {
                        if (node.hash) {
                            prefetchFileContent(sessionId, node.path, node.hash);
                        }
                    }}
                >
                    <span className="size-3.5 shrink-0" />
                    <button
                        type="button"
                        onClick={open}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                        <FileTypeIcon kind="file" name={node.name} className="size-4" />
                        <span
                            className={cn(
                                "truncate",
                                decoration && decoration !== "modified" && meta.className
                            )}
                        >
                            {node.name}
                        </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5">
                        <button
                            type="button"
                            aria-label="Download file"
                            className="hover:bg-background/80 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() =>
                                withContent(sessionId, node.path, (content) =>
                                    downloadText(node.path, content)
                                )
                            }
                        >
                            <DownloadIcon className="size-3.5" />
                        </button>
                        {decoration && (
                            <span
                                className={cn(
                                    "w-3 text-center font-mono text-[11px] font-semibold",
                                    meta.className
                                )}
                                title={meta.label}
                            >
                                {meta.letter}
                            </span>
                        )}
                    </div>
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-52">
                <ContextMenuItem onClick={() => void copyText(node.path)}>
                    <CopyIcon className="size-3.5" />
                    Copy path
                </ContextMenuItem>
                <ContextMenuItem
                    onClick={() =>
                        withContent(sessionId, node.path, (content) => void copyText(content))
                    }
                >
                    <CopyIcon className="size-3.5" />
                    Copy content
                </ContextMenuItem>
                <ContextMenuItem
                    onClick={() =>
                        withContent(sessionId, node.path, (content) =>
                            downloadText(node.path, content)
                        )
                    }
                >
                    <DownloadIcon className="size-3.5" />
                    Download
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onOpenTimeline(node.path)}>
                    <ClockIcon className="size-3.5" />
                    Reveal in Timeline
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}

export function FileTree({
    sessionId,
    onOpenTimeline,
}: {
    sessionId: string;
    onOpenTimeline: (path: string) => void;
}) {
    const flattened = useFileTreeStore((state) => state.flattened);
    const selectedPath = useFileTreeStore((state) => state.selectedPath);
    const expandedPaths = useFileTreeStore((state) => state.expandedPaths);
    const toggleExpanded = useFileTreeStore((state) => state.toggleExpanded);

    const parentRef = useRef<HTMLDivElement>(null);
    const virtualizer = useVirtualizer({
        count: flattened.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 16,
    });

    return (
        <div className="flex h-full flex-col">
            <div className="text-muted-foreground flex h-8 shrink-0 items-center px-3 text-[11px] font-medium tracking-wide uppercase">
                Explorer
            </div>
            {flattened.length === 0 ? (
                <div className="text-muted-foreground flex flex-1 items-center justify-center p-4 text-center text-xs">
                    Waiting for files…
                </div>
            ) : (
                <div ref={parentRef} className="flex-1 overflow-auto">
                    <div
                        className="relative w-full"
                        style={{ height: `${virtualizer.getTotalSize()}px` }}
                    >
                        {virtualizer.getVirtualItems().map((virtualRow) => {
                            const item = flattened[virtualRow.index];
                            if (!item) {
                                return null;
                            }
                            const { node, depth } = item;
                            return (
                                <div
                                    key={node.path}
                                    className="absolute top-0 left-0 w-full"
                                    style={{
                                        height: `${virtualRow.size}px`,
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    {node.type === "directory" ? (
                                        <DirectoryRow
                                            node={node}
                                            depth={depth}
                                            expanded={expandedPaths.has(node.path)}
                                            onToggle={() => toggleExpanded(node.path)}
                                        />
                                    ) : (
                                        <FileRow
                                            node={node}
                                            depth={depth}
                                            sessionId={sessionId}
                                            active={selectedPath === node.path}
                                            onOpenTimeline={onOpenTimeline}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
