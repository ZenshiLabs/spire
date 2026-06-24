"use client";

import { XIcon } from "lucide-react";
import { memo, useCallback } from "react";

import { FileTypeIcon } from "@/components/file-icon";
import { Button } from "@/components/ui/button";
import { baseName } from "@spire/types";
import { cn } from "@/lib/utils";

export const Tab = memo(function Tab({
    path,
    active,
    setActiveFile,
    setSelectedPath,
    closeFile,
}: {
    path: string;
    active: boolean;
    setActiveFile: (path: string) => void;
    setSelectedPath: (path: string | null) => void;
    closeFile: (path: string) => void;
}) {
    const handleSelect = useCallback(() => {
        setActiveFile(path);
        setSelectedPath(path);
    }, [path, setActiveFile, setSelectedPath]);

    const handleClose = useCallback(() => closeFile(path), [path, closeFile]);

    return (
        <div
            role="tab"
            aria-selected={active}
            className={cn(
                "group flex items-center gap-1.5 rounded-md py-1 pr-1 pl-2.5 text-xs transition-colors",
                active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50"
            )}
        >
            <Button
                variant="ghost"
                className="h-auto gap-1.5 p-0 font-mono text-xs whitespace-nowrap hover:bg-transparent"
                onClick={handleSelect}
            >
                <FileTypeIcon kind="file" name={baseName(path)} className="size-3.5" />
                {baseName(path)}
            </Button>
            <Button
                variant="ghost"
                size="icon"
                aria-label={`Close ${baseName(path)}`}
                className="size-5 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={handleClose}
            >
                <XIcon className="size-3" />
            </Button>
        </div>
    );
});
