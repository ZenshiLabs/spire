import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { CliTranscript } from "@/components/landing/cli-transcript";
import { InstallCommand } from "@/components/landing/copy-command";
import { NavAnchor, PendingSectionScroll } from "@/components/landing/nav-anchor";
import { IconWell, Surface } from "@/components/landing/primitives";
import { Reveal } from "@/components/landing/reveal";
import {
  ClosingCta,
  FeatureBento,
  HowItWorks,
  SectionHeading,
  SelfHost,
  WhyNotScreenShare,
} from "@/components/landing/sections";
import {
  CONTAINER,
  GITHUB_URL,
  SiteFooter,
  SiteHeader,
} from "@/components/landing/site-chrome";
import { ViewerFrame } from "@/components/landing/viewer-frame";
import { Button } from "@/components/ui/button";
import { DEMO_SESSION_ID } from "@/lib/demo-session";
import { cn } from "@/lib/utils";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const sessionPath = `/session/${DEMO_SESSION_ID}`;
const shareUrl = `${siteUrl}${sessionPath}`;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Spire",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "macOS, Linux, Windows",
      description:
        "Broadcast a local directory so others can watch it live in real time. No accounts; the session ID is the share link.",
      url: siteUrl,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      author: { "@type": "Organization", name: "ZenshiLabs" },
    },
    {
      "@type": "Organization",
      name: "ZenshiLabs",
      url: siteUrl,
      sameAs: [GITHUB_URL],
    },
  ],
};

export default function Home() {
  return (
    <div className="relative overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[44rem]"
      >
        <span className="spire-grid spire-grid-hero absolute inset-0" />
        <span className="spire-bloom absolute inset-x-0 top-0 h-[28rem] opacity-50" />
      </div>

      <span
        aria-hidden
        className="spire-grain pointer-events-none fixed inset-0 z-10"
      />

      <SiteHeader />
      <PendingSectionScroll />

      <main>
        <section className={cn(CONTAINER, "pt-10 pb-16 md:pt-16 md:pb-24")}>
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
            <div className="spire-rise">
              <h1 className="max-w-[15ch] text-[clamp(2.25rem,8vw,4.25rem)] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
                Share the code. Not your screen.
              </h1>
              <p className="text-muted-foreground mt-5 max-w-[46ch] text-base leading-relaxed sm:text-lg">
                Run one command. Spire streams the files you save to a browser
                tab, syntax highlighted and read-only.
              </p>

              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-end">
                <InstallCommand />
                <Button
                  asChild
                  variant="outline"
                  className="group h-12 w-full gap-2 rounded-full py-0 pr-1.5 pl-5 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] sm:w-auto"
                >
                  <NavAnchor section="viewer" className="cursor-pointer">
                    See the viewer
                    <IconWell className="bg-muted ml-auto sm:ml-0">
                      <ArrowRightIcon className="size-4" strokeWidth={1.5} />
                    </IconWell>
                  </NavAnchor>
                </Button>
              </div>
            </div>

            <div className="spire-rise" style={{ animationDelay: "140ms" }}>
              <CliTranscript sessionId={DEMO_SESSION_ID} shareUrl={shareUrl} />
            </div>
          </div>
        </section>

        <section id="viewer" className={cn(CONTAINER, "pb-16 md:pb-24")}>
          <SectionHeading
            title="This is what your link opens."
            lead="Every save becomes a checkpoint. Viewers scrub back through all of them, or jump straight to live."
          />

          <Reveal delay={120} className="mt-8 md:mt-10">
            <Surface className="rounded-3xl p-2" coreClassName="rounded-2xl">
              <ViewerFrame
                src={`${sessionPath}?embed=1`}
                title="Spire session viewer, showing a recorded broadcast of the Spire repository"
              />
            </Surface>
          </Reveal>

          <Reveal delay={200}>
            <p className="text-muted-foreground mt-4 text-xs">
              A finished broadcast of this repository.{" "}
              <Link
                href={sessionPath}
                className="hover:text-foreground underline underline-offset-4 transition-colors"
              >
                Open it full screen
              </Link>
              .
            </p>
          </Reveal>
        </section>

        <WhyNotScreenShare />
        <HowItWorks shareUrl={shareUrl} />
        <FeatureBento shareUrl={shareUrl} />
        <SelfHost />
        <ClosingCta />
      </main>

      <SiteFooter />
    </div>
  );
}
