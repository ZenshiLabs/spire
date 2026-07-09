export const DEMO_FILE = "src/watcher/checkpoint-batcher.ts";

export type TranscriptTone = "rail" | "accent";

export type TranscriptLine = {
  glyph: string;
  tone: TranscriptTone;
  text: string;
};

export function cliTranscript(
  sessionId: string,
  shareUrl: string
): TranscriptLine[] {
  return [
    { glyph: "┌", tone: "rail", text: "Spire CLI" },
    { glyph: "│", tone: "rail", text: "" },
    { glyph: "◇", tone: "accent", text: `spire → ${shareUrl}` },
    { glyph: "│", tone: "rail", text: "" },
    { glyph: "◆", tone: "accent", text: `Started ${sessionId}.` },
    { glyph: "●", tone: "accent", text: "Watch /Users/you/spire" },
    { glyph: "●", tone: "accent", text: `Share: ${shareUrl}` },
    {
      glyph: "●",
      tone: "accent",
      text: "Watching for changes. Press Ctrl+C to stop.",
    },
    { glyph: "│", tone: "rail", text: `Synced checkpoint #1 (${DEMO_FILE})` },
    { glyph: "│", tone: "rail", text: "Synced checkpoint #2 (2 files)" },
  ];
}

export const DEFAULT_IGNORES = [
  "node_modules/**",
  ".git/**",
  ".env",
  ".env.*",
  "dist/**",
  ".next/**",
  "build/**",
  "out/**",
  "coverage/**",
  ".build/**",
];

export const WORKSPACE_PROJECTS = [
  { dir: "./apps/api", title: "API" },
  { dir: "./apps/web", title: "Web" },
] as const;

export const CHANGED_SAMPLE = [
  { path: "src/watcher/checkpoint-batcher.ts", changed: true },
  { path: "src/watcher/hash-registry.ts", changed: true },
  { path: "src/api/client.ts", changed: true },
  { path: "src/index.ts", changed: false },
];
