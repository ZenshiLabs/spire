"use client";

import { FilesIcon, GitGraphIcon } from "lucide-react";

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActivityView = "explorer" | "timeline";

const ITEMS: { view: ActivityView; label: string; Icon: typeof FilesIcon }[] = [
    { view: "explorer", label: "Explorer", Icon: FilesIcon },
    { view: "timeline", label: "Timeline", Icon: GitGraphIcon },
];

export function ActivityBar({
    view,
    onChange,
}: {
    view: ActivityView;
    onChange: (view: ActivityView) => void;
}) {
    return (
        <TooltipProvider delayDuration={300}>
            <nav
                aria-label="Views"
                className="bg-sidebar flex w-12 shrink-0 flex-col items-center gap-1 border-r py-2"
            >
                {ITEMS.map(({ view: itemView, label, Icon }) => {
                    const active = view === itemView;
                    return (
                        <Tooltip key={itemView}>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    aria-label={label}
                                    aria-pressed={active}
                                    onClick={() => onChange(itemView)}
                                    className={cn(
                                        "relative size-10",
                                        active
                                            ? "text-foreground hover:text-foreground"
                                            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                                    )}
                                >
                                    {active && (
                                        <span className="bg-primary absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-r" />
                                    )}
                                    <Icon className="size-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">{label}</TooltipContent>
                        </Tooltip>
                    );
                })}
            </nav>
        </TooltipProvider>
    );
}
