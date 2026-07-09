import Link from "next/link";

import { NavAnchor } from "@/components/landing/nav-anchor";
import { GitHubGlyph } from "@/components/landing/primitives";
import { ModeToggle } from "@/components/mode-toggle";
import { SpireMark } from "@/components/spire-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const GITHUB_URL = "https://github.com/ZenshiLabs/spire";
export const NPM_URL = "https://www.npmjs.com/package/@zenshilabs/spire";

export const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6";

const SECTION_LINKS = [
  { section: "viewer", label: "Viewer" },
  { section: "why", label: "Why Spire" },
  { section: "how", label: "How it works" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-2 z-40 sm:top-3">
      <div className={CONTAINER}>
        <div className="border-border/60 bg-background/70 flex h-14 items-center gap-2 rounded-full border pr-2 pl-4 backdrop-blur-xl sm:pl-5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <SpireMark size={20} title="Spire" />
            <span className="text-[15px] font-semibold tracking-tight">
              Spire
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex lg:ml-6">
            {SECTION_LINKS.map((link) => (
              <NavAnchor
                key={link.section}
                section={link.section}
                className="text-muted-foreground hover:text-foreground cursor-pointer rounded-full px-3 py-1.5 text-[13px] transition-colors"
              >
                {link.label}
              </NavAnchor>
            ))}
            <Link
              href="/docs"
              className="text-muted-foreground hover:text-foreground rounded-full px-3 py-1.5 text-[13px] transition-colors"
            >
              Docs
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-1 [&_button]:rounded-full">
            <Button asChild variant="ghost" size="icon">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer">
                <GitHubGlyph className="size-4" />
                <span className="sr-only">Spire on GitHub</span>
              </a>
            </Button>
            <ModeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-border/60 border-t">
      <div
        className={cn(
          CONTAINER,
          "text-muted-foreground flex flex-col gap-5 py-8 text-sm sm:flex-row sm:items-center sm:py-10"
        )}
      >
        <div className="flex items-center gap-2.5">
          <SpireMark size={18} />
          <span className="text-foreground font-medium">Spire</span>
          <span className="hidden sm:inline">Live code sharing, no accounts.</span>
        </div>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:ml-auto">
          <Link href="/docs" className="hover:text-foreground transition-colors">
            Docs
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
          <a
            href={NPM_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            npm
          </a>
          <span className="text-muted-foreground/70">© 2026 ZenshiLabs</span>
        </nav>
      </div>
    </footer>
  );
}
