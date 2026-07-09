import type { ComponentProps, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

type SurfaceProps = ComponentProps<"div"> & {
  coreClassName?: string;
  children: ReactNode;
};

export function Surface({
  className,
  coreClassName,
  children,
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn(
        "border-border/70 bg-muted/50 rounded-2xl border p-1.5",
        "shadow-[0_1px_1px_oklch(0_0_0_/_0.03),0_28px_70px_-48px_oklch(0_0_0_/_0.28)]",
        "dark:shadow-[0_1px_1px_oklch(0_0_0_/_0.2),0_28px_70px_-48px_oklch(0_0_0_/_0.75)]",
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "border-border/50 overflow-hidden rounded-lg border",
          "shadow-[inset_0_1px_0_oklch(1_0_0_/_0.7)]",
          "dark:shadow-[inset_0_1px_0_oklch(1_0_0_/_0.05)]",
          coreClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="bg-muted text-foreground/90 rounded-md px-1.5 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  );
}

export function IconWell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full",
        "transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "group-hover:translate-x-0.5 group-hover:-translate-y-px",
        className
      )}
    >
      {children}
    </span>
  );
}

export function GitHubGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
