import {
  ArrowRightIcon,
  ClipboardIcon,
  Code2Icon,
  EyeIcon,
  FilesIcon,
  GitBranchIcon,
  GlobeIcon,
  GraduationCapIcon,
  HistoryIcon,
  LockIcon,
  MonitorPlayIcon,
  RadioIcon,
  ServerIcon,
  TerminalIcon,
  UsersIcon,
  VideoOffIcon,
} from "lucide-react";
import Link from "next/link";

import { ModeToggle } from "@/components/mode-toggle";
import { CopyCommand } from "@/components/landing/copy-command";
import { SpireMark } from "@/components/spire-mark";
import { Button } from "@/components/ui/button";
import { JoinForm } from "./join-form";

const GITHUB_URL = "https://github.com/anishshobithps/spire";

export default function Home() {
  return (
    <div className="relative flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Problem />
        <Audience />
        <HowItWorks />
        <Features />
        <WatchSection />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <SpireMark size={26} title="Spire" />
          <span className="text-lg font-semibold tracking-tight">Spire</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-1 text-sm text-muted-foreground md:flex">
          <a className="rounded-md px-3 py-2 transition-colors hover:text-foreground" href="#why">
            Why Spire
          </a>
          <a className="rounded-md px-3 py-2 transition-colors hover:text-foreground" href="#who">
            Who it&rsquo;s for
          </a>
          <a className="rounded-md px-3 py-2 transition-colors hover:text-foreground" href="#how">
            How it works
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" aria-label="Spire on GitHub">
              <GitHubGlyph />
            </a>
          </Button>
          <ModeToggle />
          <Button
            asChild
            className="bg-spire text-spire-foreground shadow-sm hover:bg-spire/90"
          >
            <a href="#start">Start broadcasting</a>
          </Button>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[640px] spire-grid" />
        <div className="absolute inset-x-0 -top-32 h-[460px] spire-bloom opacity-70" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pt-14 pb-16 sm:px-6 sm:pt-16 sm:pb-20 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pt-24 lg:pb-28">
        <div className="spire-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-spire opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-spire" />
            </span>
            Live code sharing
          </span>

          <h1 className="mt-5 text-[clamp(2.25rem,7vw,4.5rem)] leading-[1.04] font-semibold tracking-tight text-balance">
            Let people watch your code &mdash; without sharing your screen.
          </h1>

          <p className="mt-5 max-w-xl text-base text-muted-foreground text-pretty sm:text-lg">
            Spire broadcasts the files you&rsquo;re working on to a browser tab.
            Run one command, share the link, and anyone can follow along as you
            save &mdash; real, syntax-highlighted code, not a blurry video feed.
            No call, no install, no account.
          </p>

          <div id="start" className="mt-8 flex flex-wrap items-center gap-3">
            <CopyCommand command="npx spire start" />
            <Button asChild variant="outline" size="lg" className="h-[46px]">
              <a href="#watch">
                <EyeIcon /> Watch a session
              </a>
            </Button>
          </div>

          <dl className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Stat label="Read-only for viewers" />
            <Stat label="No account or install" />
            <Stat label="Updates on every save" />
          </dl>
        </div>

        <div className="spire-rise" style={{ animationDelay: "120ms" }}>
          <BroadcastPreview />
        </div>
      </div>
    </section>
  );
}

function Stat({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-1.5 rounded-full bg-spire" />
      <dt>{label}</dt>
    </div>
  );
}

/**
 * An honest snapshot of what broadcasting actually looks like: the CLI output
 * a broadcaster sees. No fake editor and no invented metrics — just the share
 * link and the save-by-save checkpoint log the tool really prints.
 */
function BroadcastPreview() {
  return (
    <figure className="overflow-hidden rounded-xl border border-white/10 bg-[#0d1014] font-mono text-[12.5px] leading-relaxed shadow-2xl shadow-black/40 ring-1 ring-black/5 sm:text-[13px]">
      <figcaption className="sr-only">
        Terminal output from running spire start: an uploaded snapshot, a share
        link, and a log of synced checkpoints.
      </figcaption>

      {/* Title bar */}
      <div
        aria-hidden
        className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3"
      >
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-[#ff5f57]" />
          <span className="size-3 rounded-full bg-[#febc2e]" />
          <span className="size-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="ml-1 text-xs text-zinc-500">spire &mdash; broadcasting</span>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-spire/30 bg-spire/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-spire">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-spire opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-spire" />
          </span>
          LIVE
        </span>
      </div>

      {/* Body */}
      <div aria-hidden className="space-y-1 overflow-x-auto px-4 py-4 whitespace-nowrap">
        <div>
          <span className="text-spire">$</span>{" "}
          <span className="text-zinc-200">npx spire start</span>
        </div>
        <div className="text-emerald-400">
          <span className="text-emerald-500">✓</span> Initial snapshot uploaded
        </div>
        <div className="text-emerald-400">
          <span className="text-emerald-500">✓</span> Started session{" "}
          <span className="text-zinc-200">k3f9zq2a</span>
        </div>
        <div className="text-zinc-400">
          Share with viewers:{" "}
          <span className="text-spire">…/session/k3f9zq2a</span>
        </div>
        <div className="text-zinc-500">Watching for changes. Ctrl+C to stop.</div>
        <div className="pt-1 text-zinc-400">
          <span className="text-zinc-600">·</span> Synced checkpoint{" "}
          <span className="text-zinc-300">#1</span>{" "}
          <span className="text-zinc-500">(src/index.ts)</span>
        </div>
        <div className="text-zinc-400">
          <span className="text-zinc-600">·</span> Synced checkpoint{" "}
          <span className="text-zinc-300">#2</span>{" "}
          <span className="text-zinc-500">(3 files)</span>
        </div>
      </div>
    </figure>
  );
}

const PROBLEMS = [
  {
    icon: VideoOffIcon,
    title: "Screen sharing is heavy",
    body: "Text turns to mush, it taxes your machine and your connection, and your whole desktop goes on display. Viewers can’t scroll or zoom on their own.",
  },
  {
    icon: GitBranchIcon,
    title: "A branch isn’t live",
    body: "“Just pull it” means they need the repo and the right environment set up — and they only see your work after you stop and push.",
  },
  {
    icon: ClipboardIcon,
    title: "Snippets lose the project",
    body: "Pasted code drops the file tree and the context around it, and goes stale the moment you keep typing.",
  },
] as const;

function Problem() {
  return (
    <section id="why" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-28">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-balance">
          Showing your code as you work is clumsy
        </h2>
        <p className="mt-3 text-base text-muted-foreground text-pretty sm:text-lg">
          The usual ways to let someone follow along all get in the way of
          actually writing the code.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-3">
        {PROBLEMS.map((p) => (
          <article
            key={p.title}
            className="rounded-2xl border border-border bg-card/50 p-6"
          >
            <span className="grid size-11 place-items-center rounded-lg border border-border bg-background text-muted-foreground">
              <p.icon className="size-5" />
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">
              {p.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              {p.body}
            </p>
          </article>
        ))}
      </div>

      <p className="mt-8 max-w-2xl text-base text-pretty sm:text-lg">
        Spire sits in between: a <span className="font-medium">live, read-only
        view of your actual files</span>, shared with a link.
      </p>
    </section>
  );
}

const AUDIENCES = [
  {
    icon: GraduationCapIcon,
    title: "Teaching & workshops",
    body: "Everyone watches on their own device — even a phone in the back row. Nothing to install for a full room, and latecomers can scroll back through what you already wrote.",
  },
  {
    icon: UsersIcon,
    title: "Mentoring & pairing",
    body: "Follow a teammate across timezones without keeping a video call open. Read-only lets you watch a tree you don’t have checked out locally.",
  },
  {
    icon: GlobeIcon,
    title: "Building in public",
    body: "Drop a link in a PR, Slack, or a stream and let people watch you build. Your working tree stays yours — viewers can never edit it.",
  },
] as const;

function Audience() {
  return (
    <section
      id="who"
      className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-28"
    >
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-balance">
          Who it&rsquo;s for
        </h2>
        <p className="mt-3 text-base text-muted-foreground text-pretty sm:text-lg">
          Anyone who needs people to see code as it changes &mdash; without
          dragging them into a call or a local setup.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-3">
        {AUDIENCES.map((a) => (
          <article
            key={a.title}
            className="rounded-2xl border border-border bg-card/50 p-6 transition-colors hover:border-spire/40"
          >
            <span className="grid size-11 place-items-center rounded-lg border border-spire/25 bg-spire/10 text-spire">
              <a.icon className="size-5" />
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">
              {a.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground text-pretty">
              {a.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  {
    n: "01",
    icon: TerminalIcon,
    title: "Run spire start",
    body: "Spire watches your project and opens a session, then prints a share link the moment it’s ready.",
  },
  {
    n: "02",
    icon: GitBranchIcon,
    title: "Share the link",
    body: "Drop it in a PR, Slack, or a classroom. Viewers open it in a browser — no account, no client.",
  },
  {
    n: "03",
    icon: RadioIcon,
    title: "They watch on save",
    body: "Each save syncs the files that changed. Viewers see your project update a moment later, and can rewind through every checkpoint.",
  },
] as const;

function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-28">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-balance">
          From your terminal to their screen
        </h2>
        <p className="mt-3 text-base text-muted-foreground text-pretty sm:text-lg">
          One command on your machine, a link for everyone else. That&rsquo;s
          the whole flow.
        </p>
      </div>

      <ol className="relative mt-10 grid gap-8 sm:mt-12 md:grid-cols-3 md:gap-6">
        <div
          aria-hidden
          className="absolute top-7 right-8 left-8 hidden border-t border-dashed border-border md:block"
        />
        {STEPS.map((step) => (
          <li key={step.n} className="relative">
            <div className="flex items-center gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-border bg-background text-spire">
                <step.icon className="size-6" />
              </span>
              <span className="font-mono text-sm font-medium text-muted-foreground">
                {step.n}
              </span>
            </div>
            <h3 className="mt-5 text-lg font-semibold tracking-tight">
              {step.title}
            </h3>
            <p className="mt-2 text-muted-foreground text-pretty">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Features() {
  return (
    <section
      id="features"
      className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-28"
    >
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-balance">
          A thin layer over the editor you already use
        </h2>
        <p className="mt-3 text-base text-muted-foreground text-pretty sm:text-lg">
          Spire sends the changes you save, not a picture of your screen.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-3">
        {/* wide hero feature */}
        <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card/50 p-6 md:col-span-2 md:p-8">
          <div>
            <FeatureIcon>
              <RadioIcon className="size-5" />
            </FeatureIcon>
            <h3 className="mt-5 text-xl font-semibold tracking-tight">
              Changed files, not screens
            </h3>
            <p className="mt-2 max-w-md text-muted-foreground text-pretty">
              Each save uploads only the files that changed, addressed by content
              hash and deduplicated &mdash; re-saving a file to an earlier state
              costs nothing. Viewers get the update a moment after you save, with
              no video and no whole-desktop capture.
            </p>
          </div>

          <div className="mt-6 w-fit rounded-xl border border-white/10 bg-[#0d1014] px-4 py-3 font-mono text-xs leading-relaxed text-zinc-400 shadow-sm">
            <div>
              <span className="text-zinc-600">·</span> Synced checkpoint{" "}
              <span className="text-zinc-300">#11</span>{" "}
              <span className="text-zinc-500">(src/app.ts)</span>
            </div>
            <div>
              <span className="text-zinc-600">·</span> Synced checkpoint{" "}
              <span className="text-zinc-300">#12</span>{" "}
              <span className="text-zinc-500">(3 files)</span>
            </div>
          </div>

          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-spire/10 blur-3xl transition-opacity group-hover:opacity-80"
          />
        </article>

        <Feature
          icon={<Code2Icon className="size-5" />}
          title="Editor-grade highlighting"
          body="Monaco and Shiki render your code with the same syntax colors and layout you see while writing it."
        />
        <Feature
          icon={<LockIcon className="size-5" />}
          title="Read-only by design"
          body="Watchers follow along and nothing more. Your working tree is never exposed to edits."
        />
        <Feature
          icon={<HistoryIcon className="size-5" />}
          title="Rewind the session"
          body="Every save is a checkpoint. Viewers can scrub back through the history, then jump straight back to live."
        />
        <Feature
          icon={<MonitorPlayIcon className="size-5" />}
          title="Nothing to install"
          body="Viewers open a link. It works in any modern browser, on a laptop or a phone in the back row."
        />
        <Feature
          icon={<FilesIcon className="size-5" />}
          title="Multi-file aware"
          body="A real file tree. Switch files as you work and every viewer can follow along."
        />
        <Feature
          icon={<ServerIcon className="size-5" />}
          title="Yours to host"
          body="Postgres-backed sessions, with optional Redis to run across instances. Host it on your own infrastructure."
        />
      </div>
    </section>
  );
}

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-11 place-items-center rounded-lg border border-spire/25 bg-spire/10 text-spire">
      {children}
    </span>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card/50 p-6 transition-colors hover:border-spire/40">
      <FeatureIcon>{icon}</FeatureIcon>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">{body}</p>
    </article>
  );
}

function WatchSection() {
  return (
    <section id="watch" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
      <div className="grid items-center gap-8 rounded-2xl border border-border bg-card/50 p-6 sm:p-8 md:grid-cols-2 md:p-12">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl text-balance">
            Got a session link? Drop in.
          </h2>
          <p className="mt-3 max-w-md text-muted-foreground text-pretty">
            Paste the ID a broadcaster shared with you and start watching their
            project update on every save. No account needed.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-sm font-medium">
            <EyeIcon className="size-4 text-spire" />
            Watch a session
          </div>
          <JoinForm />
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <TerminalIcon className="size-3.5 shrink-0" />
            Broadcasting instead? Run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
              npx spire start
            </code>
          </p>
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e13] px-6 py-16 text-center sm:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 spire-grid opacity-60" />
          <div className="absolute inset-x-0 -top-24 h-64 spire-bloom" />
        </div>

        <div className="relative mx-auto max-w-2xl">
          <SpireMark size={40} title="Spire" className="mx-auto block" />
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-white sm:text-4xl text-balance">
            Show your work in the open.
          </h2>
          <p className="mt-4 text-base text-zinc-400 text-pretty sm:text-lg">
            Run a workshop, mentor across timezones, or just let people watch you
            build. One command starts a session; a link lets anyone follow.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <CopyCommand command="npx spire start" />
            <Button
              asChild
              size="lg"
              className="h-[46px] bg-spire text-spire-foreground hover:bg-spire/90"
            >
              <a href="#watch">
                Watch a session <ArrowRightIcon />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2">
          <SpireMark size={22} title="Spire" />
          <span className="font-semibold tracking-tight">Spire</span>
          <span className="text-sm text-muted-foreground">
            &mdash; live code sharing
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <a className="transition-colors hover:text-foreground" href="#why">
            Why Spire
          </a>
          <a className="transition-colors hover:text-foreground" href="#who">
            Who it&rsquo;s for
          </a>
          <a className="transition-colors hover:text-foreground" href="#how">
            How it works
          </a>
          <a
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
          >
            <GitHubGlyph className="size-4" />
            GitHub
          </a>
        </nav>

        <p className="text-sm text-muted-foreground">© 2026 Spire</p>
      </div>
    </footer>
  );
}


function GitHubGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className ?? "size-5"}
    >
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.26 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
    </svg>
  );
}
