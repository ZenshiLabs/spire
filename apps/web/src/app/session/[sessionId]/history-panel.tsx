"use client";

import { baseName, type CheckpointChange } from "@spire/types";
import { useFileTreeStore } from "@spire/stores/file-tree-store";
import { useHistoryStore } from "@spire/stores/history-store";
import { ArrowUpIcon } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";

import { FileTypeIcon } from "@/components/file-icon";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CHANGE_META, dirName, formatRelativeTime } from "@/lib/change-meta";
import { fetchCheckpoint } from "@/lib/session-api";
import { decorationsFromChanges } from "@/lib/use-session-stream";
import { cn } from "@/lib/utils";

type CheckpointRowProps = {
    seq: number;
    label: string;
    createdAt: string;
    filesChanged: number;
    additions: number;
    deletions: number;
    selected: boolean;
    onSelect: (seq: number) => void;
};

/**
 * A single timeline entry. Memoized on primitive props so a live checkpoint
 * prepended to the list only mounts the new row — existing rows keep identical
 * props and skip re-render — rather than re-rendering the whole timeline on
 * every incoming save-burst.
 */
const CheckpointRow = memo(function CheckpointRow({
    seq,
    label,
    createdAt,
    filesChanged,
    additions,
    deletions,
    selected,
    onSelect,
}: CheckpointRowProps) {
    return (
        <Button
            variant="ghost"
            onClick={() => onSelect(seq)}
            className={cn(
                "hover:bg-accent/50 h-auto w-full flex-col items-start gap-0.5 rounded-none px-3 py-2 transition-colors",
                selected && "bg-accent/60"
            )}
        >
            <div className="flex w-full items-center gap-2">
                <span className="truncate text-sm font-medium">{label}</span>
                <span className="text-muted-foreground ml-auto shrink-0 text-[11px]">
                    {formatRelativeTime(createdAt)}
                </span>
            </div>
            <div className="text-muted-foreground flex items-center gap-2 font-mono text-[11px]">
                <span>
                    {filesChanged} file{filesChanged === 1 ? "" : "s"}
                </span>
                {additions > 0 && (
                    <span className="text-emerald-500">+{additions}</span>
                )}
                {deletions > 0 && <span className="text-red-500">−{deletions}</span>}
            </div>
        </Button>
    );
});

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
    const [loadFailed, setLoadFailed] = useState(false);
    const [retryNonce, setRetryNonce] = useState(0);

    // Fetch the full checkpoint whenever the selected seq isn't cached. Selection
    // can come from a row click or from the auto-select on opening the timeline
    // view — the latter has no click handler to fetch for it, so the fetch must
    // key off the selection itself or the change list never loads.
    useEffect(() => {
        if (selectedSeq === null || selectedCheckpoint) {
            return;
        }
        setLoadFailed(false);
        const controller = new AbortController();
        fetchCheckpoint(sessionId, selectedSeq, controller.signal)
            .then((checkpoint) => {
                useHistoryStore.getState().cacheCheckpoint(checkpoint);
                useFileTreeStore
                    .getState()
                    .setDecorations(decorationsFromChanges(checkpoint.changes));
                onSelectChange(checkpoint.changes[0] ?? null);
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setLoadFailed(true);
                }
            });
        return () => controller.abort();
    }, [sessionId, selectedSeq, selectedCheckpoint, onSelectChange, retryNonce]);

    const handleSelect = useCallback(
        (seq: number) => {
            const history = useHistoryStore.getState();
            if (history.selectedSeq === seq) {
                history.selectSeq(null);
                useFileTreeStore.getState().setDecorations(new Map());
                onSelectChange(null);
                return;
            }
            history.selectSeq(seq);
            const cached = history.bySeq.get(seq);
            if (cached) {
                useFileTreeStore
                    .getState()
                    .setDecorations(decorationsFromChanges(cached.changes));
                onSelectChange(cached.changes[0] ?? null);
            } else {
                onSelectChange(null);
            }
        },
        [onSelectChange]
    );

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
                <Button
                    variant="ghost"
                    onClick={jumpToLatest}
                    className="bg-primary/10 text-primary hover:bg-primary/15 h-auto w-full justify-center gap-1.5 rounded-none border-y py-1.5 text-xs font-medium"
                >
                    <ArrowUpIcon className="size-3.5" />
                    {newWhileBrowsing} new change{newWhileBrowsing > 1 ? "s" : ""} — jump to latest
                </Button>
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
                                    <CheckpointRow
                                        seq={checkpoint.seq}
                                        label={checkpoint.label}
                                        createdAt={checkpoint.createdAt}
                                        filesChanged={checkpoint.filesChanged}
                                        additions={checkpoint.additions}
                                        deletions={checkpoint.deletions}
                                        selected={selected}
                                        onSelect={handleSelect}
                                    />

                                    {selected && (
                                        <div className="border-t">
                                            {!selectedCheckpoint ? (
                                                loadFailed ? (
                                                    <div className="text-muted-foreground flex items-center gap-2 px-3 py-2 text-xs">
                                                        Couldn&apos;t load changes.
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-5 px-1.5 text-xs"
                                                            onClick={() =>
                                                                setRetryNonce((nonce) => nonce + 1)
                                                            }
                                                        >
                                                            Retry
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="px-3 py-2">
                                                        <Skeleton className="h-4 w-full" />
                                                    </div>
                                                )
                                            ) : (
                                                selectedCheckpoint.changes.map((change) => {
                                                    const meta = CHANGE_META[change.changeType];
                                                    const active = selectedChange?.path === change.path;
                                                    const dir = dirName(change.path);
                                                    return (
                                                        <Button
                                                            key={change.path}
                                                            variant="ghost"
                                                            onClick={() => onSelectChange(change)}
                                                            className={cn(
                                                                "hover:bg-accent/50 h-auto w-full items-center justify-start gap-1.5 rounded-none py-1 pr-2 pl-6 text-xs transition-colors",
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
                                                            {dir && (
                                                                <span className="text-muted-foreground/70 truncate text-[10px]">
                                                                    {dir}
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
                                                        </Button>
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
