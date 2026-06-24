"use client";

import { baseName, type ChangeType, type CheckpointChange } from "@spire/types";
import { useFileTreeStore } from "@spire/stores/file-tree-store";
import { useHistoryStore } from "@spire/stores/history-store";
import { ArrowUpIcon } from "lucide-react";

import { FileTypeIcon } from "@/components/file-icon";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CHANGE_META, dirName, formatRelativeTime } from "@/lib/change-meta";
import { fetchCheckpoint } from "@/lib/session-api";
import { cn } from "@/lib/utils";

function decorationsFromChanges(changes: CheckpointChange[]): Map<string, ChangeType> {
    const map = new Map<string, ChangeType>();
    for (const change of changes) {
        map.set(change.path, change.changeType);
    }
    return map;
}

export function HistoryPanel({
    sessionId,
    selectedChange,
    onSelectChange,
}: {
    sessionId: string;
    selectedChange: CheckpointChange | null;
    onSelectChange: (change: CheckpointChange | null) => void;
}) {
    const checkpoints = useHistoryStore((state) => state.checkpoints);
    const selectedSeq = useHistoryStore((state) => state.selectedSeq);
    const newWhileBrowsing = useHistoryStore((state) => state.newWhileBrowsing);
    const selectedCheckpoint = useHistoryStore((state) =>
        state.selectedSeq !== null ? state.bySeq.get(state.selectedSeq) : undefined
    );

    const onSelect = async (seq: number) => {
        const history = useHistoryStore.getState();
        if (history.selectedSeq === seq) {
            history.selectSeq(null);
            useFileTreeStore.getState().setDecorations(new Map());
            onSelectChange(null);
            return;
        }
        history.selectSeq(seq);
        onSelectChange(null);
        let checkpoint = history.bySeq.get(seq);
        if (!checkpoint) {
            try {
                checkpoint = await fetchCheckpoint(sessionId, seq);
                useHistoryStore.getState().cacheCheckpoint(checkpoint);
            } catch {
                return;
            }
        }
        useFileTreeStore.getState().setDecorations(decorationsFromChanges(checkpoint.changes));
        if (checkpoint.changes.length > 0) {
            onSelectChange(checkpoint.changes[0] ?? null);
        }
    };

    const jumpToLatest = () => {
        useHistoryStore.getState().selectSeq(null);
        useFileTreeStore.getState().setDecorations(new Map());
        onSelectChange(null);
    };

    return (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="text-muted-foreground flex h-8 shrink-0 items-center px-3 text-[11px] font-medium tracking-wide uppercase">
                Timeline
            </div>

            {newWhileBrowsing > 0 && (
                <button
                    type="button"
                    onClick={jumpToLatest}
                    className="bg-primary/10 text-primary hover:bg-primary/15 flex shrink-0 items-center justify-center gap-1.5 border-y py-1.5 text-xs font-medium"
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
                <ScrollArea className="h-0 flex-1">
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
                                        <div className="border-t">
                                            {!selectedCheckpoint ? (
                                                <div className="px-3 py-2">
                                                    <Skeleton className="h-4 w-full" />
                                                </div>
                                            ) : (
                                                selectedCheckpoint.changes.map((change) => {
                                                    const meta = CHANGE_META[change.changeType];
                                                    const active = selectedChange?.path === change.path;
                                                    return (
                                                        <button
                                                            key={change.path}
                                                            type="button"
                                                            onClick={() => onSelectChange(change)}
                                                            className={cn(
                                                                "hover:bg-accent/50 flex w-full items-center gap-1.5 py-1 pr-2 pl-6 text-left text-xs transition-colors",
                                                                active && "bg-accent/70"
                                                            )}
                                                        >
                                                            <FileTypeIcon
                                                                kind="file"
                                                                name={baseName(change.path)}
                                                                className="size-3.5 shrink-0"
                                                            />
                                                            <span className="truncate">
                                                                {baseName(change.path)}
                                                            </span>
                                                            {dirName(change.path) && (
                                                                <span className="text-muted-foreground/70 truncate text-[10px]">
                                                                    {dirName(change.path)}
                                                                </span>
                                                            )}
                                                            <span className="ml-auto flex shrink-0 items-center gap-1 font-mono text-[10px]">
                                                                {change.additions > 0 && (
                                                                    <span className="text-emerald-500">
                                                                        +{change.additions}
                                                                    </span>
                                                                )}
                                                                {change.deletions > 0 && (
                                                                    <span className="text-red-500">
                                                                        −{change.deletions}
                                                                    </span>
                                                                )}
                                                                <span className={cn("w-3 text-center font-semibold", meta.className)}>
                                                                    {meta.letter}
                                                                </span>
                                                            </span>
                                                        </button>
                                                    );
                                                })
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
