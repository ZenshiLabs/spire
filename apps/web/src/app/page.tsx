import { TerminalIcon } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";
import { JoinForm } from "./join-form";

export default function Home() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      <main className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">Spire</h1>
          <p className="text-muted-foreground text-sm">
            Live code sharing. Share a session link and anyone can watch your
            code update in real time.
          </p>
        </div>

        <div className="bg-card space-y-4 rounded-xl border p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">Watch a session</h2>
            <p className="text-muted-foreground text-xs">
              Got a session ID? Enter it to follow along live.
            </p>
          </div>
          <JoinForm />
        </div>

        <p className="text-muted-foreground flex items-center justify-center gap-2 text-center text-xs">
          <TerminalIcon className="size-3.5 shrink-0" />
          <span>
            Broadcasting? Run{" "}
            <code className="bg-muted rounded px-1.5 py-0.5 font-mono">
              spire start
            </code>{" "}
            in your project.
          </span>
        </p>
      </main>
    </div>
  );
}
