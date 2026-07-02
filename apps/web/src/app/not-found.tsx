import Link from "next/link";

import { SpireMark } from "@/components/spire-mark";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-6 text-center">
      <SpireMark size={44} />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="text-muted-foreground max-w-md text-sm">
          This page doesn&apos;t exist. If you were following a session link, it
          may have ended and been cleaned up.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button asChild>
          <Link href="/">Back home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/docs">Read the docs</Link>
        </Button>
      </div>
    </div>
  );
}
