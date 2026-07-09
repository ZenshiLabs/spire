import {
  AppWindowIcon,
  ArrowRightIcon,
  DatabaseIcon,
  FileJsonIcon,
  GitBranchIcon,
  GlobeIcon,
  HistoryIcon,
  LayersIcon,
  LinkIcon,
  LockIcon,
  PackageIcon,
  RotateCcwIcon,
  SaveIcon,
  ScaleIcon,
  TerminalIcon,
} from "lucide-react";
import type { ComponentType, CSSProperties, ReactNode } from "react";

import { InstallCommand } from "@/components/landing/copy-command";
import { JoinForm } from "@/components/landing/join-form";
import { Code, Surface } from "@/components/landing/primitives";
import { Reveal } from "@/components/landing/reveal";
import { CONTAINER } from "@/components/landing/site-chrome";
import {
  CHANGED_SAMPLE,
  DEFAULT_IGNORES,
  WORKSPACE_PROJECTS,
} from "@/lib/landing-demo";
import { cn } from "@/lib/utils";

const MUSH_SAMPLE = `if (next === "deleted") {
    return prev === "added" ? null : "deleted";
}
if (next === "added") {
    return prev === "deleted" ? "modified" : prev;
}
return prev === "added" ? "added" : "modified";
`;

export function SectionHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <Reveal className="max-w-2xl">
      <h2 className="text-[clamp(1.6rem,5.2vw,2.5rem)] leading-[1.12] font-semibold tracking-[-0.03em] text-balance">
        {title}
      </h2>
      <p className="text-muted-foreground mt-3 max-w-[52ch] text-sm leading-relaxed sm:text-[15px]">
        {lead}
      </p>
    </Reveal>
  );
}

const FAILURES = [
  {
    title: "Text turns to mush.",
    body: "Video codecs are tuned for faces, not for 12px monospace. Viewers cannot zoom, cannot scroll, and cannot copy a line.",
    tilt: "lg:-rotate-[1.1deg] lg:hover:rotate-0",
  },
  {
    title: "Your whole desktop comes along.",
    body: "Notifications, browser tabs, the other repository you had open. A screen share has no idea what you meant to show.",
    tilt: "lg:translate-y-8 lg:rotate-[0.7deg] lg:hover:translate-y-4 lg:hover:rotate-0",
    icon: AppWindowIcon,
  },
  {
    title: "A branch is not live.",
    body: "Pushing means they see the work after you stopped doing it, and only if they already have the repository checked out.",
    tilt: "lg:-translate-y-4 lg:-rotate-[0.5deg] lg:hover:-translate-y-8 lg:hover:rotate-0",
    icon: GitBranchIcon,
  },
];

export function WhyNotScreenShare() {
  return (
    <section id="why" className={cn(CONTAINER, "py-16 md:py-24")}>
      <SectionHeading
        title="Screen sharing was never built for this."
        lead="It ships pixels of your desktop and hopes the letters survive. Spire ships the files you saved."
      />

      <div className="mt-10 grid gap-4 md:mt-12 lg:grid-cols-3">
        {FAILURES.map((failure, index) => {
          const Icon = failure.icon;

          return (
            <Reveal key={failure.title} delay={index * 90}>
              <article
                className={cn(
                  "border-border/70 bg-card h-full rounded-2xl border p-5 sm:p-6",
                  "shadow-[0_20px_50px_-40px_oklch(0_0_0_/_0.35)] dark:shadow-[0_20px_50px_-40px_oklch(0_0_0_/_0.9)]",
                  "transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  failure.tilt
                )}
              >
                {index === 0 ? (
                  <pre
                    aria-hidden
                    className="border-border/60 bg-muted/40 text-muted-foreground mb-5 h-24 overflow-hidden rounded-lg border p-3 font-mono text-[11px] leading-[1.6] blur-[2.4px] contrast-75 select-none"
                  >
                    {MUSH_SAMPLE}
                  </pre>
                ) : Icon ? (
                  <div className="border-border/70 bg-muted/40 mb-5 grid size-10 place-items-center rounded-xl border">
                    <Icon className="text-muted-foreground size-5" strokeWidth={1.5} />
                  </div>
                ) : null}

                <h3 className="text-[15px] font-semibold tracking-tight">
                  {failure.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {failure.body}
                </p>
              </article>
            </Reveal>
          );
        })}
      </div>

      <Reveal delay={140}>
        <p className="text-muted-foreground mt-10 max-w-[58ch] text-sm leading-relaxed sm:text-[15px]">
          Spire sits in between: a live, read-only view of the actual files,
          behind a link.
        </p>
      </Reveal>
    </section>
  );
}

function bareUrl(url: string) {
  return url.replace(/^https?:\/\//, "");
}

function RunVisual({ shareUrl }: { shareUrl: string }) {
  return (
    <div className="bg-terminal border-terminal-foreground/10 overflow-hidden rounded-lg border font-mono">
      <div className="border-terminal-foreground/10 flex items-center gap-2 border-b px-3 py-2">
        <span className="bg-terminal-foreground/25 size-1.5 rounded-full" />
        <span className="text-terminal-foreground/40 text-[10px]">~/spire</span>
      </div>
      <div className="space-y-1.5 px-3 py-3 text-[11px] leading-relaxed">
        <div className="text-terminal-foreground/90 flex gap-2">
          <span className="text-spire shrink-0">$</span>
          <span>spire start</span>
        </div>
        <div className="text-terminal-foreground/45 flex min-w-0 gap-2">
          <span className="shrink-0">●</span>
          <span className="truncate">
            Share:{" "}
            <span className="text-spire">{bareUrl(shareUrl)}</span>
          </span>
          <span className="spire-caret-el" />
        </div>
      </div>
    </div>
  );
}

function ShareVisual({ shareUrl }: { shareUrl: string }) {
  return (
    <div className="border-border/60 bg-muted/40 space-y-3 rounded-lg border p-3">
      <div className="border-border/70 bg-background flex items-center gap-2 rounded-full border px-3 py-1.5 shadow-sm">
        <GlobeIcon
          className="text-muted-foreground size-3.5 shrink-0"
          strokeWidth={1.5}
        />
        <span className="text-foreground/80 min-w-0 truncate font-mono text-[11px]">
          {bareUrl(shareUrl)}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {["No account", "No install", "Nothing to accept"].map((chip) => (
          <span
            key={chip}
            className="border-border/60 bg-background/70 text-muted-foreground rounded-full border px-2 py-0.5 text-[10px]"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

const SAVE_ROWS = [
  { path: "checkpoint-batcher.ts", state: "modified" },
  { path: "hash-registry.ts", state: "added" },
];

function SaveVisual() {
  return (
    <div className="border-border/60 bg-muted/40 rounded-lg border p-3">
      <div className="text-muted-foreground flex items-center gap-2 font-mono text-[10.5px]">
        <span className="bg-spire size-1.5 shrink-0 rounded-full" />
        <span className="text-foreground/80">Checkpoint #12</span>
        <span className="text-muted-foreground/60">· 2 files</span>
      </div>
      <div className="mt-2 space-y-1 font-mono text-[11px]">
        {SAVE_ROWS.map((row) => (
          <div key={row.path} className="flex items-center gap-2">
            <span className="text-foreground/75 truncate">{row.path}</span>
            <span className="text-muted-foreground/50 ml-auto shrink-0 text-[10px]">
              {row.state}
            </span>
          </div>
        ))}
      </div>
      <div className="border-border/50 text-muted-foreground/70 mt-2.5 flex items-center gap-1.5 border-t pt-2 text-[10px]">
        <RotateCcwIcon className="size-3 shrink-0" strokeWidth={1.5} />
        Viewers can rewind to any earlier checkpoint
      </div>
    </div>
  );
}

type HowStepProps = {
  index: number;
  last?: boolean;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  verb: string;
  children: ReactNode;
  visual: ReactNode;
};

function HowStep({ index, last, icon: Icon, verb, children, visual }: HowStepProps) {
  return (
    <Reveal delay={index * 110} className="relative flex h-full flex-col">
      <div className="flex items-center gap-4">
        <span className="border-border/70 bg-background text-foreground/80 relative z-10 grid size-9 shrink-0 place-items-center rounded-full border font-mono text-xs shadow-sm">
          {String(index + 1).padStart(2, "0")}
        </span>
        {!last && (
          <span
            aria-hidden
            className="bg-border/70 hidden h-px flex-1 lg:-mr-6 lg:block"
          />
        )}
      </div>

      <div className="mt-4 flex items-center gap-2.5">
        <Icon className="text-muted-foreground size-4" strokeWidth={1.5} />
        <h3 className="text-base font-semibold tracking-tight sm:text-lg">
          {verb}
        </h3>
      </div>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {children}
      </p>

      <div className="mt-5">{visual}</div>
    </Reveal>
  );
}

export function HowItWorks({ shareUrl }: { shareUrl: string }) {
  return (
    <section id="how" className={cn(CONTAINER, "py-16 md:py-24")}>
      <SectionHeading
        title="From your terminal to their browser."
        lead="One command on your machine. A link for everyone else. That is the whole flow."
      />

      <div className="mt-10 grid gap-10 md:mt-14 lg:grid-cols-3 lg:gap-6">
        <HowStep index={0} icon={TerminalIcon} verb="Run" visual={<RunVisual shareUrl={shareUrl} />}>
          <Code>spire start</Code> in any project. Spire snapshots the tree, opens
          a session, and prints a share link.
        </HowStep>
        <HowStep index={1} icon={LinkIcon} verb="Share" visual={<ShareVisual shareUrl={shareUrl} />}>
          Send the link. It opens in a browser with no account to create, no
          client to install, and nothing for viewers to accept.
        </HowStep>
        <HowStep index={2} last icon={SaveIcon} verb="Save" visual={<SaveVisual />}>
          Each save syncs only the files that changed. Viewers watch it land, and
          can rewind to any earlier checkpoint.
        </HowStep>
      </div>
    </section>
  );
}

function Cell({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-border/70 bg-card relative h-full overflow-hidden rounded-2xl border p-5 sm:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FeatureBento({ shareUrl }: { shareUrl: string }) {
  return (
    <section id="features" className={cn(CONTAINER, "py-16 md:py-24")}>
      <SectionHeading
        title="A thin layer over the editor you already use."
        lead="Spire sends the changes you save, not a picture of your screen. Everything below ships today."
      />

      <div className="mt-10 grid grid-flow-dense gap-4 md:mt-12 lg:grid-cols-4 lg:grid-rows-3">
        <Reveal className="lg:col-span-2 lg:row-span-2">
          <Cell>
            <span className="bg-spire/10 pointer-events-none absolute -top-16 -right-16 size-48 rounded-full blur-3xl" />
            <h3 className="text-base font-semibold tracking-tight sm:text-lg">
              Changed files, not pixels.
            </h3>
            <p className="text-muted-foreground mt-2 max-w-[42ch] text-sm leading-relaxed">
              Spire keeps a SHA-256 of every file it watches. A save that changes
              nothing sends nothing. A save that touches one line ships one file.
            </p>

            <div className="border-border/60 bg-muted/40 mt-5 rounded-lg border p-3 font-mono text-[10.5px] sm:text-[11.5px]">
              {CHANGED_SAMPLE.map((entry) => (
                <div
                  key={entry.path}
                  className={cn(
                    "flex items-center gap-3 py-1",
                    !entry.changed && "text-muted-foreground/50"
                  )}
                >
                  <span className="truncate">{entry.path}</span>
                  <span
                    className={cn(
                      "ml-auto shrink-0",
                      entry.changed ? "text-spire" : "text-muted-foreground/40"
                    )}
                  >
                    {entry.changed ? "sent" : "skipped"}
                  </span>
                </div>
              ))}
            </div>
          </Cell>
        </Reveal>

        <Reveal delay={80} className="lg:col-span-2">
          <Cell className="bg-terminal border-terminal-foreground/10">
            <h3 className="text-terminal-foreground text-base font-semibold tracking-tight sm:text-lg">
              <span className="font-mono">.env</span> never leaves your machine.
            </h3>
            <p className="text-terminal-foreground/65 mt-2 max-w-[46ch] text-sm leading-relaxed">
              Spire honours <span className="font-mono">.gitignore</span>, and
              always ignores these regardless of what it says. Binaries are listed
              but never uploaded. Nothing over 2 MB is read.
            </p>
            <div className="text-terminal-foreground/50 mt-4 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] sm:text-[11.5px]">
              {DEFAULT_IGNORES.map((pattern) => (
                <span key={pattern}>{pattern}</span>
              ))}
            </div>
          </Cell>
        </Reveal>

        <Reveal delay={160}>
          <Cell>
            <LockIcon className="text-muted-foreground size-5" strokeWidth={1.5} />
            <h3 className="mt-4 text-[15px] font-semibold tracking-tight">
              Read-only by construction.
            </h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              There is no write path to your tree. The editor viewers get cannot
              type.
            </p>
          </Cell>
        </Reveal>

        <Reveal delay={200}>
          <Cell>
            <HistoryIcon className="text-muted-foreground size-5" strokeWidth={1.5} />
            <h3 className="mt-4 text-[15px] font-semibold tracking-tight">
              Rewind any save.
            </h3>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Every checkpoint is a diff. Scrub the timeline, open a file&apos;s
              history, jump back to live.
            </p>
          </Cell>
        </Reveal>

        <Reveal delay={240} className="lg:col-span-4">
          <Cell>
            <span
              aria-hidden
              className="spire-grid pointer-events-none absolute inset-0 opacity-70"
            />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
              <div>
                <h3 className="text-base font-semibold tracking-tight sm:text-lg">
                  The link never changes.
                </h3>
                <p className="text-muted-foreground mt-2 max-w-[58ch] text-sm leading-relaxed">
                  The session is keyed to the directory, not to the process. Run{" "}
                  <Code>spire start</Code> in the same folder next week and the
                  same URL wakes up, re-uploading only what moved.
                </p>
              </div>
              <div className="border-border/70 bg-muted/60 text-muted-foreground min-w-0 shrink-0 truncate rounded-full border px-4 py-2 font-mono text-[11px] sm:text-xs md:ml-auto">
                {shareUrl}
              </div>
            </div>
          </Cell>
        </Reveal>
      </div>
    </section>
  );
}

function Key({ children }: { children: ReactNode }) {
  return <span className="text-terminal-foreground/90">{children}</span>;
}
function Str({ children }: { children: ReactNode }) {
  return <span className="text-spire">{children}</span>;
}
function Punc({ children }: { children: ReactNode }) {
  return <span className="text-terminal-foreground/35">{children}</span>;
}

function ConfigWindow() {
  return (
    <Surface coreClassName="bg-terminal border-terminal-foreground/10">
      <div className="border-terminal-foreground/10 flex items-center gap-2 border-b px-4 py-2.5">
        <FileJsonIcon
          className="text-terminal-foreground/40 size-3.5"
          strokeWidth={1.5}
        />
        <span className="text-terminal-foreground/50 font-mono text-xs">
          spire.json
        </span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-[1.9] sm:p-5 sm:text-[13px]">
        <code>
          <Punc>{"{"}</Punc>
          {"\n  "}
          <Key>&quot;projects&quot;</Key>
          <Punc>: [</Punc>
          {WORKSPACE_PROJECTS.map((project, index) => (
            <span key={project.dir}>
              {"\n    "}
              <Punc>{"{ "}</Punc>
              <Key>&quot;dir&quot;</Key>
              <Punc>: </Punc>
              <Str>&quot;{project.dir}&quot;</Str>
              <Punc>, </Punc>
              <Key>&quot;title&quot;</Key>
              <Punc>: </Punc>
              <Str>&quot;{project.title}&quot;</Str>
              <Punc>{" }"}</Punc>
              {index < WORKSPACE_PROJECTS.length - 1 ? <Punc>,</Punc> : null}
            </span>
          ))}
          {"\n  "}
          <Punc>]</Punc>
          {"\n"}
          <Punc>{"}"}</Punc>
        </code>
      </pre>
    </Surface>
  );
}

function WorkspaceResult() {
  return (
    <div className="border-border/70 bg-card h-full rounded-2xl border p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <LayersIcon className="text-muted-foreground size-4" strokeWidth={1.5} />
        <span className="text-[15px] font-semibold tracking-tight">
          Shared workspace
        </span>
      </div>
      <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
        One command, one link. Each project is its own live session, switchable
        from the same page.
      </p>

      <div className="border-border/60 mt-4 ml-1.5 space-y-2 border-l pl-4">
        {WORKSPACE_PROJECTS.map((project) => (
          <div key={project.dir} className="relative">
            <span
              aria-hidden
              className="bg-border/60 absolute top-1/2 -left-4 h-px w-3"
            />
            <div className="border-border/60 bg-muted/40 flex items-center gap-2.5 rounded-lg border px-3 py-2">
              <span className="bg-spire size-1.5 shrink-0 rounded-full" />
              <span className="text-sm font-medium">{project.title}</span>
              <span className="text-muted-foreground/60 ml-auto shrink-0 font-mono text-[10px] tracking-wide uppercase">
                live
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const FACTS = [
  {
    icon: ScaleIcon,
    title: "MIT licensed",
    body: "Fork it, run it, change it. The API and the viewer are one Next.js app.",
  },
  {
    icon: DatabaseIcon,
    title: "Postgres, Redis optional",
    body: "Redis adds cross-instance fan-out, a read-through cache, and sequence numbers. Everything works without it.",
  },
  {
    icon: PackageIcon,
    title: "Three runtime dependencies",
    body: "The CLI ships chokidar, ignore, and @clack/prompts. Node 22 or newer.",
  },
];

export function SelfHost() {
  return (
    <section className={cn(CONTAINER, "py-16 md:py-24")}>
      <SectionHeading
        title="Broadcast a workspace. Host the whole thing."
        lead="Point a spire.json at every project you want live, and one command puts them all up, linked under a shared workspace."
      />

      <div className="mt-10 grid items-center gap-4 md:mt-14 lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
        <Reveal>
          <ConfigWindow />
        </Reveal>

        <Reveal delay={90} className="flex justify-center">
          <div className="text-muted-foreground flex flex-col items-center gap-2">
            <span className="border-border/70 bg-background grid size-9 place-items-center rounded-full border shadow-sm">
              <ArrowRightIcon
                className="size-4 rotate-90 lg:rotate-0"
                strokeWidth={1.5}
              />
            </span>
            <span className="font-mono text-[11px]">spire start</span>
          </div>
        </Reveal>

        <Reveal delay={180}>
          <WorkspaceResult />
        </Reveal>
      </div>

      <div className="border-border/70 mt-12 grid gap-8 border-t pt-8 md:mt-16 md:grid-cols-3 md:gap-0">
        {FACTS.map((fact, index) => (
          <Reveal key={fact.title} delay={index * 90}>
            <div
              className={cn(
                "md:px-8",
                index === 0 && "md:pl-0",
                index > 0 && "md:border-border/70 md:border-l"
              )}
            >
              <fact.icon
                className="text-muted-foreground size-5"
                strokeWidth={1.5}
              />
              <h3 className="mt-3 text-[15px] font-semibold tracking-tight">
                {fact.title}
              </h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {fact.body}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section id="watch" className={cn(CONTAINER, "py-16 md:py-24")}>
      <Reveal>
        <div className="bg-terminal relative isolate overflow-hidden rounded-3xl p-6 sm:p-10 lg:p-14">
          <span
            aria-hidden
            className="spire-grid pointer-events-none absolute inset-0 opacity-40"
            style={{ "--foreground": "oklch(1 0 0)" } as CSSProperties}
          />
          <span
            aria-hidden
            className="spire-bloom pointer-events-none absolute inset-x-0 top-0 h-64 opacity-60"
          />

          <div className="relative grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:gap-16">
            <div>
              <h2 className="text-terminal-foreground text-[clamp(1.6rem,5.2vw,2.5rem)] leading-[1.12] font-semibold tracking-[-0.03em] text-balance">
                Show your work in the open.
              </h2>
              <p className="text-terminal-foreground/70 mt-3 max-w-[44ch] text-sm leading-relaxed sm:text-[15px]">
                Run a workshop, mentor across timezones, or just let people watch
                you build.
              </p>
              <div className="mt-7">
                <InstallCommand tone="terminal" />
              </div>
            </div>

            <div className="border-terminal-foreground/15 bg-terminal-foreground/[0.04] rounded-2xl border p-5 sm:p-6">
              <h3 className="text-terminal-foreground mb-4 text-[15px] font-semibold tracking-tight">
                Already have a link?
              </h3>
              <JoinForm />
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
