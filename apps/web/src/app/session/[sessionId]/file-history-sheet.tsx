"use client";

import type { FileHistoryEntry } from "@spire/types";
import { baseName } from "@spire/types";
import { CheckIcon, FlagIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { FileTypeIcon } from "@/components/file-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CHANGE_META, formatRelativeTime } from "@/lib/change-meta";
import { fetchFileHistory } from "@/lib/session-api";
import { cn } from "@/lib/utils";

/** The ref used when diffing against the session's initial snapshot. */
export const SESSION_START_REF = "0";

function RevisionRow({
    entry,
    head,
    selected,
    onSelect,
}: {
    entry: FileHistoryEntry;
    head: boolean;
    selected: boolean;
    onSelect: (ref: string) => void;
}) {
    const meta = CHANGE_META[entry.changeType];
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(String(entry.seq))}
            className={cn(
                "hover:bg-accent/50 flex w-full gap-3 px-4 py-2 text-left transition-colors",
                selected && "bg-accent/60"
            )}
        >
            <span className="relative flex w-3 shrink-0 justify-center">
                <span className="bg-border absolute -inset-y-2 w-px" />
                <span
                    className={cn("relative z-10 mt-1 size-2 rounded-full", meta.dot)}
                    title={meta.label}
                />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex w-full items-center gap-2">
                    <span className="truncate text-xs font-medium">{entry.label}</span>
                    {head && (
                        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                            Latest
                        </Badge>
                    )}
                    <span className="text-muted-foreground ml-auto shrink-0 text-[11px]">
                        {formatRelativeTime(entry.createdAt)}
                    </span>
                </span>
                <span className="text-muted-foreground flex items-center gap-2 font-mono text-[11px]">
                    <span>#{entry.seq}</span>
                    <span className={meta.className}>{meta.label}</span>
                    {entry.additions > 0 && (
                        <span className="text-emerald-500">+{entry.additions}</span>
                    )}
                    {entry.deletions > 0 && (
                        <span className="text-red-500">−{entry.deletions}</span>
                    )}
                    {selected && (
                        <span className="text-primary ml-auto flex items-center gap-1">
                            <CheckIcon className="size-3.5" />
                            diff base
                        </span>
                    )}
                </span>
            </span>
        </button>
    );
}

/**
 * Per-file timeline: every checkpoint that touched the given file, newest
 * first, ending at the session's starting point. Picking an entry makes it the
 * baseline the editor's diff mode compares the current file against.
 */
export function FileHistorySheet({
    sessionId,
    path,
    open,
    onOpenChange,
    diffBase,
    onSelectBase,
}: {
    sessionId: string;
    path: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Active diff baseline ref, or null when diff mode is off. */
    diffBase: string | null;
    onSelectBase: (ref: string) => void;
}) {
    const [entries, setEntries] = useState<FileHistoryEntry[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryNonce, setRetryNonce] = useState(0);

    useEffect(() => {
        if (!open) {
            return;
        }
        setEntries(null);
        setError(null);
        const controller = new AbortController();
        fetchFileHistory(sessionId, path, controller.signal)
            .then(setEntries)
            .catch((err: unknown) => {
                if (!controller.signal.aborted) {
                    setError(
                        err instanceof Error ? err.message : "Failed to load history."
                    );
                }
            });
        return () => controller.abort();
    }, [open, sessionId, path, retryNonce]);

    // The initial snapshot (seq 0) already represents the session start; only
    // offer the synthetic "session start" baseline when it isn't in the list.
    const showSessionStart = !entries?.some((entry) => entry.seq === 0);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
                <SheetHeader className="border-b px-4 py-3">
                    <SheetTitle className="flex items-center gap-2 pr-8 text-sm">
                        <FileTypeIcon kind="file" name={baseName(path)} className="size-4" />
                        <span className="truncate">{baseName(path)}</span>
                        {entries && (
                            <Badge variant="secondary" className="h-4 shrink-0 px-1.5 text-[10px]">
                                {entries.length} revision{entries.length === 1 ? "" : "s"}
                            </Badge>
                        )}
                    </SheetTitle>
                    <SheetDescription className="truncate font-mono text-xs">
                        {path}
                    </SheetDescription>
                    <p className="text-muted-foreground text-xs">
                        Pick a revision to diff the current file against.
                    </p>
                </SheetHeader>

                {error ? (
                    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-xs">
                        {error}
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setRetryNonce((nonce) => nonce + 1)}
                        >
                            Retry
                        </Button>
                    </div>
                ) : !entries ? (
                    <div className="space-y-3 p-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-9 w-full" />
                        ))}
                    </div>
                ) : entries.length === 0 ? (
                    <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-center text-xs">
                        No recorded changes for this file yet.
                    </div>
                ) : (
                    <ScrollArea className="min-h-0 flex-1">
                        <div className="py-2">
                            {entries.map((entry, index) => (
                                <RevisionRow
                                    key={entry.seq}
                                    entry={entry}
                                    head={index === 0}
                                    selected={diffBase === String(entry.seq)}
                                    onSelect={onSelectBase}
                                />
                            ))}
                            {showSessionStart && (
                                <button
                                    type="button"
                                    aria-pressed={diffBase === SESSION_START_REF}
                                    onClick={() => onSelectBase(SESSION_START_REF)}
                                    className={cn(
                                        "hover:bg-accent/50 flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                                        diffBase === SESSION_START_REF && "bg-accent/60"
                                    )}
                                >
                                    <span className="flex w-3 shrink-0 justify-center">
                                        <FlagIcon className="text-muted-foreground size-3" />
                                    </span>
                                    <span className="text-xs font-medium">Session start</span>
                                    {diffBase === SESSION_START_REF && (
                                        <span className="text-primary ml-auto flex items-center gap-1 font-mono text-[11px]">
                                            <CheckIcon className="size-3.5" />
                                            diff base
                                        </span>
                                    )}
                                </button>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </SheetContent>
        </Sheet>
    );
}
