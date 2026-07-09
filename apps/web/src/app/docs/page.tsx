import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { CopyCommand } from "@/components/landing/copy-command";
import { Code } from "@/components/landing/primitives";
import { SiteFooter, SiteHeader } from "@/components/landing/site-chrome";

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
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="text-muted-foreground space-y-4 text-sm leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Command({ children }: { children: string }) {
  return <CopyCommand command={children} className="my-3 max-w-full" />;
}

function Snippet({ children }: { children: string }) {
  return (
    <pre className="border-border/70 bg-muted/50 overflow-x-auto rounded-2xl border p-5 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  );
}

export default function DocsPage() {
  return (
    <div className="relative">
      <SiteHeader />

      <div className="mx-auto grid max-w-5xl gap-12 px-6 pt-16 pb-24 md:grid-cols-[180px_1fr]">
        <nav className="hidden md:block">
          <ul className="sticky top-28 space-y-2 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="space-y-14">
          <div>
            <h1 className="text-[clamp(2rem,4vw,2.75rem)] leading-[1.1] font-semibold tracking-[-0.03em]">
              Documentation
            </h1>
            <p className="text-muted-foreground mt-4 max-w-[58ch] leading-relaxed">
              Spire broadcasts a local directory so anyone with the link can
              watch your files change live. No accounts, and nothing for viewers
              to install.
            </p>
          </div>

          <Section id="getting-started" title="Getting started">
            <p>
              From the directory you want to share, run one command. The CLI
              downloads on first use, so there is nothing to install globally.
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
              restarts. Only the files that changed while you were away are
              re-uploaded.
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
                <Code>--title &lt;text&gt;</Code> sets the session title (single
                directory only).
              </li>
              <li>
                <Code>--session &lt;id&gt;</Code> resumes a specific session id
                (single directory only).
              </li>
              <li>
                <Code>--dir &lt;path&gt;</Code> is an alias for a positional
                directory, and may be repeated.
              </li>
            </ul>

            <h3 className="text-foreground pt-2 font-medium">spire list</h3>
            <p>
              List every known session and whether its broadcast process is still
              live.
            </p>

            <h3 className="text-foreground pt-2 font-medium">spire status</h3>
            <p>
              Show details for the current directory&apos;s session, or a summary
              of all sessions when the current directory has none.
            </p>

            <h3 className="text-foreground pt-2 font-medium">spire stop</h3>
            <p>
              Stop the current directory&apos;s session. Use{" "}
              <Code>--dir &lt;path&gt;</Code> to target another directory, or{" "}
              <Code>--all</Code> to stop every session. Live broadcasts flush a
              final checkpoint before ending.
            </p>
            <p>
              Running <Code>spire</Code> with no command opens an interactive
              picker. There is no <Code>--help</Code> or <Code>--version</Code>{" "}
              flag.
            </p>

            <h3 className="text-foreground pt-4 font-medium">
              Workspaces (spire.json)
            </h3>
            <p>
              Drop a <Code>spire.json</Code> in a directory to broadcast a fixed
              set of projects with a bare <Code>spire start</Code>. Sessions
              started this way share a workspace id, which the CLI generates and
              writes back to the file on first run.
            </p>
            <Snippet>{`{
  "title": "My App",
  "projects": [
    { "dir": "./backend", "title": "Backend" },
    { "dir": "./frontend", "title": "Frontend" }
  ]
}`}</Snippet>

            <h3 className="text-foreground pt-4 font-medium">
              What gets watched
            </h3>
            <p>
              Spire reads the <Code>.gitignore</Code> at the root of the
              directory, and always ignores <Code>node_modules</Code>,{" "}
              <Code>.git</Code>, and every <Code>.env</Code> file regardless of
              what it says. Build output directories appear in the tree but their
              contents are never watched or uploaded. Binary files are listed with
              their size and hash, but their bytes stay on your machine, and no
              file over 2 MB is read.
            </p>

            <h3 className="text-foreground pt-4 font-medium">Environment</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <Code>SPIRE_API_URL</Code> is the server to broadcast to. Defaults
                to <Code>http://localhost:3000</Code>, so point it at your
                instance to share links outside your machine.
              </li>
              <li>
                <Code>SPIRE_HEARTBEAT_MS</Code> is the liveness ping interval
                (default 10000).
              </li>
              <li>
                <Code>SPIRE_IDLE_MS</Code>, <Code>SPIRE_MAX_WAIT_MS</Code>, and{" "}
                <Code>SPIRE_STABILITY_MS</Code> tune save-burst batching (defaults
                120, 1000, and 75 milliseconds).
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
                <Code>DATABASE_URL</Code> is a Postgres connection string (a Neon
                database works out of the box).
              </li>
              <li>
                <Code>REDIS_URL</Code> is optional. It enables cross-instance
                pub/sub, caching, and sequence counters. Without it the server
                runs single-instance in-process.
              </li>
              <li>
                <Code>CRON_SECRET</Code> is a bearer token protecting the
                retention cleanup endpoint.
              </li>
              <li>
                <Code>SPIRE_RETENTION_DAYS</Code> is how long ended sessions are
                kept before deletion (default 30).
              </li>
            </ul>
            <p>
              Retention runs via a scheduled call to{" "}
              <Code>/api/cron/cleanup</Code>. On Vercel this is wired through{" "}
              <Code>vercel.json</Code>; elsewhere, hit it on a schedule:
            </p>
            <Snippet>{`curl -H "Authorization: Bearer $CRON_SECRET" \\
  https://your-instance/api/cron/cleanup`}</Snippet>
          </Section>

          <div className="border-border/70 border-t pt-8">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Back to home
            </Link>
          </div>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
