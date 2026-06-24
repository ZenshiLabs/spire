"use client";

import { useEditorStore } from "@spire/stores/editor-store";
import { useFileTreeStore } from "@spire/stores/file-tree-store";
import { useEffect, useMemo, useState } from "react";

import { FileTypeIcon } from "@/components/file-icon";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { baseName } from "@spire/types";
import { dirName } from "@/lib/change-meta";

/** VSCode-style quick file open (Ctrl/Cmd+P). */
export function QuickOpen() {
    const [open, setOpen] = useState(false);
    const headMeta = useFileTreeStore((state) => state.headMeta);
    const openFile = useEditorStore((state) => state.openFile);
    const setSelectedPath = useFileTreeStore((state) => state.setSelectedPath);
    const expandAncestors = useFileTreeStore((state) => state.expandAncestors);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") {
                event.preventDefault();
                setOpen((value) => !value);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    const paths = useMemo(() => [...headMeta.keys()].sort(), [headMeta]);

    const select = (path: string) => {
        openFile(path);
        setSelectedPath(path);
        expandAncestors(path);
        setOpen(false);
    };

    return (
        <CommandDialog
            open={open}
            onOpenChange={setOpen}
            title="Go to File"
            description="Search files by name or path"
        >
            <CommandInput placeholder="Go to file…" />
            <CommandList>
                <CommandEmpty>No files found.</CommandEmpty>
                <CommandGroup>
                    {paths.map((path) => (
                        <CommandItem key={path} value={path} onSelect={() => select(path)}>
                            <FileTypeIcon kind="file" name={baseName(path)} className="size-4" />
                            <span className="font-medium">{baseName(path)}</span>
                            <span className="text-muted-foreground truncate text-xs">
                                {dirName(path)}
                            </span>
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
