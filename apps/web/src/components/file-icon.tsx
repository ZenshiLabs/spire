"use client";

import { File, Folder, FolderOpen } from "lucide-react";

import {
    fileIconName,
    folderIconName,
    iconUrl,
    useIconManifest,
} from "@/lib/file-icons";
import { cn } from "@/lib/utils";

type FileTypeIconProps = {
    name: string;
    kind: "file" | "directory";
    expanded?: boolean;
    className?: string;
};

/**
 * Material-icon-theme icon for a file or folder, resolved from the lazily-loaded
 * manifest. Renders the SVG as a CSS background (multicolor, no <img> lint
 * warning) and falls back to a lucide icon until the manifest loads.
 */
export function FileTypeIcon({
    name,
    kind,
    expanded = false,
    className,
}: FileTypeIconProps) {
    const manifest = useIconManifest();
    const resolved =
        kind === "directory"
            ? folderIconName(manifest, name, expanded)
            : fileIconName(manifest, name);
    const url = iconUrl(resolved);

    if (url) {
        return (
            <span
                aria-hidden
                className={cn("shrink-0 bg-contain bg-center bg-no-repeat", className)}
                style={{ backgroundImage: `url("${url}")` }}
            />
        );
    }

    if (kind === "directory") {
        const Fallback = expanded ? FolderOpen : Folder;
        return <Fallback className={cn("shrink-0 text-sky-500", className)} />;
    }

    return <File className={cn("text-muted-foreground shrink-0", className)} />;
}
