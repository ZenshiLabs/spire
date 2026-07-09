import { Surface } from "@/components/landing/primitives";
import { cliTranscript, type TranscriptTone } from "@/lib/landing-demo";
import { cn } from "@/lib/utils";

const TONE: Record<TranscriptTone, string> = {
  rail: "text-terminal-foreground/35",
  accent: "text-spire",
};

export function CliTranscript({
  sessionId,
  shareUrl,
}: {
  sessionId: string;
  shareUrl: string;
}) {
  const lines = cliTranscript(sessionId, shareUrl);

  return (
    <Surface coreClassName="bg-terminal border-terminal-foreground/10">
      <div className="border-terminal-foreground/10 flex items-center gap-2 border-b px-4 py-2.5">
        <span className="bg-terminal-foreground/25 size-2 rounded-full" />
        <span className="text-terminal-foreground/40 font-mono text-xs">
          ~/spire
        </span>
      </div>

      <pre className="text-terminal-foreground overflow-x-auto px-4 py-3.5 font-mono text-[11px] leading-[1.85] sm:text-[12.5px]">
        <code>
          {lines.map((line, index) => (
            <span
              key={`${line.glyph}-${index}`}
              className="spire-rise flex gap-2.5"
              style={{ animationDelay: `${240 + index * 70}ms` }}
            >
              <span className={cn("w-2 shrink-0", TONE[line.tone])}>
                {line.glyph}
              </span>
              <span
                className={cn(
                  line.tone === "rail" && line.text
                    ? "text-terminal-foreground/60"
                    : undefined
                )}
              >
                {line.text || " "}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </Surface>
  );
}
