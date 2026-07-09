"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { IconWell } from "@/components/landing/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const PACKAGE_MANAGERS = [
  { id: "npm", command: "npx @zenshilabs/spire start" },
  { id: "pnpm", command: "pnpm dlx @zenshilabs/spire start" },
  { id: "bun", command: "bunx @zenshilabs/spire start" },
  { id: "yarn", command: "yarn dlx @zenshilabs/spire start" },
] as const;

function useCopy(command: string) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return { copied, copy };
}

export function CopyCommand({
  command,
  className,
}: {
  command: string;
  className?: string;
}) {
  const { copied, copy } = useCopy(command);

  return (
    <>
      <Button
        type="button"
        onClick={copy}
        aria-label={`Copy command: ${command}`}
        className={cn(
          "group border-terminal-foreground/10 bg-terminal text-terminal-foreground flex h-12 w-full min-w-0 gap-2.5 rounded-full border py-0 pr-1.5 pl-4 font-mono text-xs sm:w-auto sm:gap-3 sm:pl-5 sm:text-sm",
          "hover:bg-terminal hover:border-spire/60 hover:text-terminal-foreground",
          "shadow-[0_1px_1px_oklch(0_0_0_/_0.05),0_18px_40px_-28px_oklch(0_0_0_/_0.6)]",
          "focus-visible:ring-spire/50 focus-visible:ring-[3px]",
          "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]",
          className
        )}
      >
        <span className="text-spire shrink-0 select-none">$</span>
        <span className="min-w-0 flex-1 truncate text-left">{command}</span>
        <IconWell className="bg-terminal-foreground/10 group-hover:bg-terminal-foreground/15">
          {copied ? (
            <CheckIcon className="text-spire size-3.5" strokeWidth={1.5} />
          ) : (
            <CopyIcon className="size-3.5" strokeWidth={1.5} />
          )}
        </IconWell>
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </>
  );
}

const TAB_TONE = {
  default: {
    active: "bg-muted text-foreground font-medium",
    idle: "text-muted-foreground hover:text-foreground",
  },
  terminal: {
    active: "bg-terminal-foreground/10 text-terminal-foreground font-medium",
    idle: "text-terminal-foreground/55 hover:text-terminal-foreground",
  },
} as const;

export function InstallCommand({
  tone = "default",
  className,
}: {
  tone?: keyof typeof TAB_TONE;
  className?: string;
}) {
  const [active, setActive] =
    useState<(typeof PACKAGE_MANAGERS)[number]["id"]>("npm");

  const selected =
    PACKAGE_MANAGERS.find((manager) => manager.id === active) ??
    PACKAGE_MANAGERS[0];

  return (
    <div className={cn("w-full min-w-0 sm:w-auto", className)}>
      <div role="tablist" aria-label="Package manager" className="mb-2 flex gap-1">
        {PACKAGE_MANAGERS.map((manager) => (
          <button
            key={manager.id}
            type="button"
            role="tab"
            aria-selected={manager.id === active}
            onClick={() => setActive(manager.id)}
            className={cn(
              "focus-visible:ring-spire/50 rounded-full px-2.5 py-1 text-xs transition-colors outline-none focus-visible:ring-[3px]",
              manager.id === active
                ? TAB_TONE[tone].active
                : TAB_TONE[tone].idle
            )}
          >
            {manager.id}
          </button>
        ))}
      </div>

      <CopyCommand command={selected.command} />
    </div>
  );
}
