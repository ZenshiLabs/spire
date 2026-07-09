"use client";

import { ArrowRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { IconWell } from "@/components/landing/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function JoinForm() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");

  const trimmed = sessionId.trim();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed) {
      return;
    }
    router.push(`/session/${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Label
        htmlFor="session-id"
        className="text-terminal-foreground/70 text-xs font-medium"
      >
        Session ID
      </Label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="session-id"
          name="session-id"
          value={sessionId}
          onChange={(event) => setSessionId(event.target.value)}
          placeholder="k3f9zq2a"
          autoComplete="off"
          spellCheck={false}
          className="border-terminal-foreground/20 bg-terminal-foreground/5 text-terminal-foreground placeholder:text-terminal-foreground/50 focus-visible:border-spire focus-visible:ring-spire/40 h-12 w-full rounded-full px-5 font-mono text-sm"
        />

        <Button
          type="submit"
          disabled={!trimmed}
          className="group bg-spire text-spire-foreground hover:bg-spire/90 h-12 shrink-0 gap-2 rounded-full py-0 pr-1.5 pl-5 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
        >
          Open session
          <IconWell className="bg-spire-foreground/15">
            <ArrowRightIcon className="size-4" strokeWidth={1.5} />
          </IconWell>
        </Button>
      </div>

      <p className="text-terminal-foreground/60 text-xs">
        Viewers are read-only. Nothing is installed, and no account is created.
      </p>
    </form>
  );
}
