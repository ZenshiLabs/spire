"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyCommandProps = {
  /** The command shown after the prompt and copied to the clipboard. */
  command: string;
  className?: string;
};

/**
 * A terminal-style pill that copies its command on click. Used as the hero's
 * primary call to action — broadcasting is a CLI action, so the honest CTA is
 * the command itself rather than a fake "Start" button.
 */
export function CopyCommand({ command, className }: CopyCommandProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="outline"
      onClick={() => {
        navigator.clipboard?.writeText(command).then(
          () => setCopied(true),
          () => setCopied(false)
        );
      }}
      aria-label={`Copy command: ${command}`}
      className={cn(
        "group h-auto gap-3 rounded-lg border-terminal-foreground/10 bg-terminal py-2.5 pr-2.5 pl-4 font-mono text-sm text-terminal-foreground shadow-sm hover:bg-terminal hover:text-terminal-foreground hover:border-spire/60 focus-visible:ring-spire/50 focus-visible:ring-[3px]",
        className
      )}
    >
      <span aria-hidden className="select-none text-spire">
        $
      </span>
      <span className="tracking-tight">{command}</span>
      <span className="ml-1 grid size-7 place-items-center rounded-md border border-terminal-foreground/10 bg-terminal-foreground/5 text-terminal-foreground/60 transition-colors group-hover:text-terminal-foreground">
        {copied ? (
          <CheckIcon className="size-3.5 text-spire" />
        ) : (
          <CopyIcon className="size-3.5" />
        )}
      </span>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </Button>
  );
}
