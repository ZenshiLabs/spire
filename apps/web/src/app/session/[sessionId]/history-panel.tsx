"use client";

import type { ChangeType, CheckpointChange } from "@spire/types";
import { useFileTreeStore } from "@spire/stores/file-tree-store";
import { useHistoryStore } from "@spire/stores/history-store";
import { ArrowUpIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { FileTypeIcon } from "@/components/file-icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { MonacoDiffViewer } from "@/components/monaco-viewer";
import { baseName, CHANGE_META, dirName, formatRelativeTime } from "@/lib/change-meta";
import { fetchCheckpoint } from "@/lib/session-api";
import { useFileContent } from "@/lib/use-file-content";
import { cn } from "@/lib/utils";

function decorationsFromChanges(
    changes: CheckpointChange[]
): Map<string, ChangeType> {
    const map = new Map<string, ChangeType>();
    for (const change of changes) {
        map.set(change.path, change.changeType);
    }
    return map;
}

function ChangeDiff({
    sessionId,
    change,
}: {
    sessionId: string;
    change: CheckpointChange;
}) {
    const before = useFileContent(sessionId, change.path, change.beforeHash, {
        binary: change.binary,
    });
    const after = useFileContent(sessionId, change.path, change.afterHash, {
        binary: change.binary,
    });

    if (change.binary) {
        return (
            <div className="text-muted-foreground bg-muted/30 p-4 text-center text-xs">
                Binary file — diff not available.
            </div>
        );
    }
    if (before.loading || after.loading) {
        return <Skeleton className="h-[280px] w-full rounded-none" />;
    }
    return (
        <div className="h-[280px] border-y">
            <MonacoDiffViewer
                path={change.path}
                original={before.content ?? ""}
                modified={after.content ?? ""}
                sideBySide={false}
            />
        </div>
    );
}

function ChangeRow({
    sessionId,
    change,
    open,
    onToggle,
}: {
    sessionId: string;
    change: CheckpointChange;
    open: boolean;
    onToggle: () => void;
}) {
    const decoration = CHANGE_META[change.changeType];
    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                className="hover:bg-accent/50 flex w-full items-center gap-1.5 py-1 pr-2 pl-3 text-left text-xs"
            >
                <ChevronRightIcon
                    className={cn(
                        "text-muted-foreground size-3 shrink-0 transition-transform",
                        open && "rotate-90"
                    )}
                />
                <FileTypeIcon kind="file" name={baseName(change.path)} className="size-3.5" />
                <span className="truncate">{baseName(change.path)}</span>
                <span className="text-muted-foreground/70 truncate">{dirName(change.path)}</span>
                <span className="ml-auto flex shrink-0 items-center gap-1.5 font-mono">
                    {change.additions > 0 && (
                        <span className="text-emerald-500">+{change.additions}</span>
                    )}
                    {change.deletions > 0 && (
                        <span className="text-red-500">−{change.deletions}</span>
                    )}
                    <span className={cn("w-3 text-center font-semibold", decoration.className)}>
                        {decoration.letter}
                    </span>
                </span>
            </button>
            {open && <ChangeDiff sessionId={sessionId} change={change} />}
        </div>
    );
}

export function HistoryPanel({ sessionId }: { sessionId: string }) {
    const checkpoints = useHistoryStore((state) => state.checkpoints);
    const selectedSeq = useHistoryStore((state) => state.selectedSeq);
    const newWhileBrowsing = useHistoryStore((state) => state.newWhileBrowsing);
    const [openPath, setOpenPath] = useState<string | null>(null);

    const onSelect = async (seq: number) => {
        const history = useHistoryStore.getState();
        if (history.selectedSeq === seq) {
            history.selectSeq(null);
            useFileTreeStore.getState().setDecorations(new Map());
            return;
        }
        history.selectSeq(seq);
        setOpenPath(null);
        let checkpoint = history.bySeq.get(seq);
        if (!checkpoint) {
            try {
                checkpoint = await fetchCheckpoint(sessionId, seq);
                useHistoryStore.getState().cacheCheckpoint(checkpoint);
            } catch {
                return;
            }
        }
        useFileTreeStore
            .getState()
            .setDecorations(decorationsFromChanges(checkpoint.changes));
    };

    const jumpToLatest = () => {
        useHistoryStore.getState().selectSeq(null);
        useFileTreeStore.getState().setDecorations(new Map());
    };

    const selectedCheckpoint = useHistoryStore((state) =>
        state.selectedSeq !== null ? state.bySeq.get(state.selectedSeq) : undefined
    );

    return (
        <div className="flex h-full flex-col">
            <div className="text-muted-foreground flex h-8 shrink-0 items-center px-3 text-[11px] font-medium tracking-wide uppercase">
                Timeline
            </div>

            {newWhileBrowsing > 0 && (
                <button
                    type="button"
                    onClick={jumpToLatest}
                    className="bg-primary/10 text-primary hover:bg-primary/15 flex items-center justify-center gap-1.5 border-y py-1.5 text-xs font-medium"
                >
                    <ArrowUpIcon className="size-3.5" />
                    {newWhileBrowsing} new change{newWhileBrowsing > 1 ? "s" : ""} — jump to latest
                </button>
            )}

            {checkpoints.length === 0 ? (
                <div className="text-muted-foreground flex flex-1 items-center justify-center p-4 text-center text-xs">
                    No changes yet.
                </div>
            ) : (
                <ScrollArea className="flex-1">
                    <ul>
                        {checkpoints.map((checkpoint) => {
                            const selected = selectedSeq === checkpoint.seq;
                            return (
                                <li key={checkpoint.seq} className="border-b">
                                    <button
                                        type="button"
                                        onClick={() => void onSelect(checkpoint.seq)}
                                        className={cn(
                                            "hover:bg-accent/50 flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors",
                                            selected && "bg-accent/60"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="truncate text-sm font-medium">
                                                {checkpoint.label}
                                            </span>
                                            <span className="text-muted-foreground ml-auto shrink-0 text-[11px]">
                                                {formatRelativeTime(checkpoint.createdAt)}
                                            </span>
                                        </div>
                                        <div className="text-muted-foreground flex items-center gap-2 font-mono text-[11px]">
                                            <span>
                                                {checkpoint.filesChanged} file
                                                {checkpoint.filesChanged === 1 ? "" : "s"}
                                            </span>
                                            {checkpoint.additions > 0 && (
                                                <span className="text-emerald-500">
                                                    +{checkpoint.additions}
                                                </span>
                                            )}
                                            {checkpoint.deletions > 0 && (
                                                <span className="text-red-500">
                                                    −{checkpoint.deletions}
                                                </span>
                                            )}
                                        </div>
                                    </button>

                                    {selected && (
                                        <div className="bg-muted/20 border-t py-1">
                                            {!selectedCheckpoint ? (
                                                <div className="px-3 py-2">
                                                    <Skeleton className="h-4 w-full" />
                                                </div>
                                            ) : (
                                                selectedCheckpoint.changes.map((change) => (
                                                    <ChangeRow
                                                        key={change.path}
                                                        sessionId={sessionId}
                                                        change={change}
                                                        open={openPath === change.path}
                                                        onToggle={() =>
                                                            setOpenPath((prev) =>
                                                                prev === change.path
                                                                    ? null
                                                                    : change.path
                                                            )
                                                        }
                                                    />
                                                ))
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </ScrollArea>
            )}
        </div>
    );
}
