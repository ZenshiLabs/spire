import type { ChangeType } from "@spire/types";

/** Visual treatment for each change kind (source-control decorations). */
export const CHANGE_META: Record<
    ChangeType,
    { letter: string; label: string; className: string; dot: string }
> = {
    added: {
        letter: "A",
        label: "Added",
        className: "text-emerald-500",
        dot: "bg-emerald-500",
    },
    modified: {
        letter: "M",
        label: "Modified",
        className: "text-amber-500",
        dot: "bg-amber-500",
    },
    deleted: {
        letter: "D",
        label: "Deleted",
        className: "text-red-500",
        dot: "bg-red-500",
    },
    renamed: {
        letter: "R",
        label: "Renamed",
        className: "text-sky-500",
        dot: "bg-sky-500",
    },
};

export { baseName } from "@spire/types";

export function dirName(path: string): string {
    const parts = path.split("/");
    parts.pop();
    return parts.join("/");
}

export function formatRelativeTime(iso: string): string {
    const elapsed = Date.now() - new Date(iso).getTime();
    const seconds = Math.max(0, Math.round(elapsed / 1000));
    if (seconds < 60) {
        return `${seconds}s ago`;
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.round(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    const days = Math.round(hours / 24);
    return `${days}d ago`;
}
