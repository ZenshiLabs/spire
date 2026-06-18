"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function JoinForm() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const sessionId = value.trim();

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (sessionId) {
          router.push(`/session/${encodeURIComponent(sessionId)}`);
        }
      }}
    >
      <Input
        type="text"
        name="sessionId"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Paste a session ID"
        aria-label="Session ID"
        autoComplete="off"
      />
      <Button type="submit" disabled={!sessionId}>
        Watch
      </Button>
    </form>
  );
}
