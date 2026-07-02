import type { Metadata } from "next";
import Link from "next/link";

import { CopyCommand } from "@/components/landing/copy-command";
import { SpireMark } from "@/components/spire-mark";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Get started with Spire: broadcast a directory, share the link, and let others watch your code live. CLI reference and self-hosting guide.",
};

const NAV = [
  { href: "#getting-started", label: "Getting started" },
  { href: "#cli-reference", label: "CLI reference" },
  { href: "#self-hosting", label: "Self-hosting" },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Command({ children }: { children: string }) {
  return <CopyCommand command={children} className="my-2 max-w-full" />;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  );
}

export default function DocsPage() {
  return (
    <div className="mx-auto min-h-svh max-w-5xl px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <SpireMark size={24} />
          Spire
        </Link>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          Home
        </Link>
      </header>

      <div className="grid gap-10 md:grid-cols-[200px_1fr]">
        <nav className="hidden md:block">
          <ul className="sticky top-10 space-y-2 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="space-y-12">
          <div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight">
              Documentation
            </h1>
            <p className="text-muted-foreground">
              Spire broadcasts a local directory so anyone with the link can
              watch your files change live — no accounts, no install for
              viewers.
            </p>
          </div>

          <Section id="getting-started" title="Getting started">
            <p>
              From the directory you want to share, run one command. The CLI
              downloads on first use — nothing to install globally.
            </p>
            <Command>npx @zenshilabs/spire start</Command>
            <p>
              Spire prints a share URL. Send it to anyone; they open it in a
              browser and watch your files update as you save. The session is
              read-only for viewers.
            </p>
            <p>
              Press <Code>Ctrl+C</Code> to stop. Re-running{" "}
              <Code>spire start</Code> in the same directory resumes the{" "}
              <em>same</em> URL, so a link you shared keeps working across
              restarts.
            </p>
          </Section>

          <Section id="cli-reference" title="CLI reference">
            <h3 className="text-foreground font-medium">spire start [dir…]</h3>
            <p>
              Broadcast one or more directories. With no argument it uses the
              current directory; pass paths to broadcast several projects at
              once, each as its own session:
            </p>
            <Command>npx @zenshilabs/spire start ./backend ./frontend</Command>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <Code>--title &lt;text&gt;</Code> — set the session title (single
                directory only).
              </li>
              <li>
                <Code>--session &lt;id&gt;</Code> — resume a specific session id
                (single directory only).
              </li>
              <li>
                <Code>--dir &lt;path&gt;</Code> — legacy alias for a positional
                directory.
              </li>
            </ul>

            <h3 className="text-foreground pt-2 font-medium">spire list</h3>
            <p>
              List every known session and whether its broadcast process is
              still live.
            </p>

            <h3 className="text-foreground pt-2 font-medium">spire status</h3>
            <p>
              Show details for the current directory&apos;s session, or a
              summary of all sessions when the current directory has none.
            </p>

            <h3 className="text-foreground pt-2 font-medium">spire stop</h3>
            <p>
              Stop the current directory&apos;s session. Use{" "}
              <Code>--dir &lt;path&gt;</Code> to target another directory or{" "}
              <Code>--all</Code> to stop every session. Live broadcasts flush a
              final checkpoint before ending.
            </p>

            <h3 className="text-foreground pt-4 font-medium">
              Workspaces (spire.json)
            </h3>
            <p>
              Drop a <Code>spire.json</Code> in a directory to broadcast a fixed
              set of projects with a bare <Code>spire start</Code>. Sessions
              started this way share a workspace id.
            </p>
            <pre className="bg-muted overflow-x-auto rounded-lg p-4 font-mono text-xs">
              {`{
  "title": "My App",
  "projects": [
    { "dir": "./backend", "title": "Backend" },
    { "dir": "./frontend", "title": "Frontend" }
  ]
}`}
            </pre>

            <h3 className="text-foreground pt-4 font-medium">Environment</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <Code>SPIRE_API_URL</Code> — the server to broadcast to
                (defaults to <Code>http://localhost:3000</Code>).
              </li>
              <li>
                <Code>SPIRE_HEARTBEAT_MS</Code> — liveness ping interval
                (default 10000).
              </li>
              <li>
                <Code>SPIRE_IDLE_MS</Code> / <Code>SPIRE_MAX_WAIT_MS</Code> /{" "}
                <Code>SPIRE_STABILITY_MS</Code> — save-burst batching timing.
              </li>
            </ul>
          </Section>

          <Section id="self-hosting" title="Self-hosting">
            <p>
              Spire is a Next.js app backed by Postgres, with optional Redis for
              multi-instance deployments. Point the CLI at your instance with{" "}
              <Code>SPIRE_API_URL</Code>.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <Code>DATABASE_URL</Code> — Postgres connection string (a Neon
                database works out of the box).
              </li>
              <li>
                <Code>REDIS_URL</Code> — optional; enables cross-instance
                pub/sub, caching, and sequence counters. Without it the server
                runs single-instance in-process.
              </li>
              <li>
                <Code>CRON_SECRET</Code> — bearer token protecting the retention
                cleanup endpoint.
              </li>
              <li>
                <Code>SPIRE_RETENTION_DAYS</Code> — how long ended sessions are
                kept before deletion (default 30).
              </li>
            </ul>
            <p>
              Retention runs via a scheduled call to{" "}
              <Code>/api/cron/cleanup</Code>. On Vercel this is wired through{" "}
              <Code>vercel.json</Code>; elsewhere, hit it on a schedule:
            </p>
            <pre className="bg-muted overflow-x-auto rounded-lg p-4 font-mono text-xs">
              {`curl -H "Authorization: Bearer $CRON_SECRET" \\
  https://your-instance/api/cron/cleanup`}
            </pre>
          </Section>

          <footer className="text-muted-foreground border-t pt-6 text-sm">
            <Link href="/" className="hover:text-foreground">
              ← Back to home
            </Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
