"use client";

import type { CheckpointChange } from "@spire/types";
import { baseName } from "@spire/types";
import { CopyIcon, DownloadIcon, WrapTextIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { CodeBreadcrumbs } from "@/components/code-breadcrumbs";
import { FileTypeIcon } from "@/components/file-icon";
import { languageForPath } from "@/components/monaco-viewer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { copyText, downloadText } from "@/lib/file-actions";
import { useFileContent } from "@/lib/use-file-content";

const MonacoDiffViewer = dynamic(
    () => import("@/components/monaco-viewer").then((m) => m.MonacoDiffViewer),
    { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> }
);

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
                        variant={!sideBySide ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
                        disabled={binary}
                        onClick={() => setSideBySide(false)}
                    >
                        Unified
                    </Button>
                    <Button
                        variant={sideBySide ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs"
                        disabled={binary}
                        onClick={() => setSideBySide(true)}
                    >
                        Split
                    </Button>
                    <Button
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

            <CodeBreadcrumbs path={selectedChange.path} />

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
