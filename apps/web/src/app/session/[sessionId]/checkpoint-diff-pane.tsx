"use client";

import type { CheckpointChange } from "@spire/types";
import { ChevronRightIcon, CopyIcon, DownloadIcon, WrapTextIcon } from "lucide-react";
import { useState } from "react";

import { FileTypeIcon } from "@/components/file-icon";
import { languageForPath, MonacoDiffViewer } from "@/components/monaco-viewer";
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

export function CheckpointDiffPane({
    sessionId,
    selectedChange,
}: {
    sessionId: string;
    selectedChange: CheckpointChange | null;
}) {
    const [sideBySide, setSideBySide] = useState(false);
    const [wrap, setWrap] = useState(false);

    const binary = Boolean(selectedChange?.binary);

    const before = useFileContent(
        sessionId,
        selectedChange && !binary ? selectedChange.path : null,
        selectedChange?.beforeHash ?? null,
        { binary }
    );
    const after = useFileContent(
        sessionId,
        selectedChange && !binary ? selectedChange.path : null,
        selectedChange?.afterHash ?? null,
        { binary }
    );

    if (!selectedChange) {
        return (
            <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-center text-sm">
                Select a file from the timeline to view its diff.
            </div>
        );
    }

    const afterContent = after.content ?? "";
    const language = languageForPath(selectedChange.path);

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 border-b">
                <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5" role="tablist">
                    <div
                        role="tab"
                        aria-selected
                        className="bg-accent text-accent-foreground flex items-center gap-1.5 rounded-md py-1 pr-2.5 pl-2.5 text-xs"
                    >
                        <FileTypeIcon kind="file" name={baseName(selectedChange.path)} className="size-3.5" />
                        <span className="font-mono whitespace-nowrap">{baseName(selectedChange.path)}</span>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1 pr-2">
                    <Button
                        type="button"
                        variant={!sideBySide ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
                        disabled={binary}
                        onClick={() => setSideBySide(false)}
                    >
                        Unified
                    </Button>
                    <Button
                        type="button"
                        variant={sideBySide ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
                        disabled={binary}
                        onClick={() => setSideBySide(true)}
                    >
                        Split
                    </Button>
                    <Button
                        type="button"
                        variant={wrap ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 w-7 p-0"
                        aria-pressed={wrap}
                        disabled={binary}
                        onClick={() => setWrap((v) => !v)}
                        title="Toggle word wrap"
                    >
                        <WrapTextIcon className="size-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={binary || !afterContent}
                        onClick={() => void copyText(afterContent)}
                        title="Copy file contents"
                    >
                        <CopyIcon className="size-3.5" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        disabled={binary || !afterContent}
                        onClick={() => downloadText(selectedChange.path, afterContent)}
                        title="Download file"
                    >
                        <DownloadIcon className="size-3.5" />
                    </Button>
                </div>
            </div>

            <Breadcrumbs path={selectedChange.path} />

            <div className="min-h-0 flex-1 border-t">
                {binary ? (
                    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                        Binary file — diff not available.
                    </div>
                ) : before.loading || after.loading ? (
                    <Skeleton className="size-full rounded-none" />
                ) : before.error ?? after.error ? (
                    <div className="text-destructive flex h-full items-center justify-center text-sm">
                        {before.error ?? after.error}
                    </div>
                ) : (
                    <MonacoDiffViewer
                        path={selectedChange.path}
                        original={before.content ?? ""}
                        modified={afterContent}
                        sideBySide={sideBySide}
                        wordWrap={wrap ? "on" : "off"}
                    />
                )}
            </div>

            <div className="text-muted-foreground bg-sidebar flex h-6 shrink-0 items-center justify-end border-t px-3 text-[11px]">
                <span className="uppercase">{language}</span>
            </div>
        </div>
    );
}
