import { ImageResponse } from "next/og";

import { DEMO_SESSION_ID } from "@/lib/demo-session";

export const runtime = "edge";
export const alt = "Spire — share the code, not your screen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GROUND = "#0d1016";
const CARD = "#111621";
const BORDER = "#232936";
const FG = "#f5f7fb";
const MUTED = "#98a2b3";
const RAIL = "#5b6675";
const ACCENT = "#5b76ff"; // oklch(0.6173 0.2057 267.32) — the dark accent.

const MONO =
  "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const bareShare = `${siteUrl}/session/${DEMO_SESSION_ID}`.replace(
  /^https?:\/\//,
  ""
);

function SpireMark() {
  const plate = (width: number, color: string, rotate: number) => (
    <div
      style={{
        width,
        height: 8,
        borderRadius: 4,
        background: color,
        transform: `rotate(${rotate}deg)`,
      }}
    />
  );

  return (
    <div
      style={{
        width: 60,
        height: 60,
        borderRadius: 15,
        background: "#161b26",
        border: `1px solid ${BORDER}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {plate(26, ACCENT, 6)}
      {plate(29, "#e8ebf2", -6)}
      {plate(31, "#e8ebf2", 6)}
    </div>
  );
}

type Seg = { t: string; c: string; caret?: boolean };

const TERMINAL_LINES: { glyph: string; glyphColor: string; segs: Seg[] }[] = [
  {
    glyph: "$",
    glyphColor: ACCENT,
    segs: [{ t: "npx @zenshilabs/spire start", c: FG }],
  },
  {
    glyph: "●",
    glyphColor: ACCENT,
    segs: [
      { t: "spire", c: MUTED },
      { t: "→", c: RAIL },
      { t: bareShare, c: ACCENT },
    ],
  },
  {
    glyph: "●",
    glyphColor: ACCENT,
    segs: [{ t: `Started ${DEMO_SESSION_ID}.`, c: FG }],
  },
  {
    glyph: "●",
    glyphColor: ACCENT,
    segs: [{ t: "Watching for changes.", c: MUTED, caret: true }],
  },
  {
    glyph: "●",
    glyphColor: RAIL,
    segs: [{ t: "Synced checkpoint #2 · 2 files", c: RAIL }],
  },
];

function Chip({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: "#12161f",
        border: `1px solid ${BORDER}`,
        borderRadius: 999,
        padding: "8px 16px",
        color: MUTED,
        fontSize: 18,
        fontFamily: MONO,
      }}
    >
      {label}
    </div>
  );
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: GROUND,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Blueprint grid. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
        {/* Vignette that fades the grid to ground, strongest top-centre — the
            mask-image the site uses isn't available in Satori. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(120% 90% at 50% -12%, transparent 42%, ${GROUND} 100%)`,
          }}
        />
        {/* Electric-blue bloom behind the headline. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(44% 42% at 27% 4%, rgba(45,91,255,0.32), transparent 72%)`,
          }}
        />

        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px 68px",
          }}
        >
          {/* Wordmark. */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <SpireMark />
            <div
              style={{
                color: FG,
                fontSize: 34,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              Spire
            </div>
          </div>

          {/* Body: headline left, terminal right. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 52,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", width: 500 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  color: ACCENT,
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: "0.22em",
                  fontFamily: MONO,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: ACCENT,
                  }}
                />
                LIVE CODE SHARING
              </div>

              <div
                style={{
                  color: FG,
                  fontSize: 68,
                  fontWeight: 600,
                  lineHeight: 1.05,
                  letterSpacing: "-0.035em",
                  marginTop: 22,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div>Share the code.</div>
                <div style={{ color: MUTED }}>Not your screen.</div>
              </div>

              <div
                style={{
                  color: MUTED,
                  fontSize: 21,
                  lineHeight: 1.5,
                  marginTop: 24,
                  maxWidth: 440,
                }}
              >
                Run one command. The files you save stream to a browser tab —
                read-only, no account.
              </div>
            </div>

            {/* Terminal card. */}
            <div
              style={{
                width: 528,
                display: "flex",
                flexDirection: "column",
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 18,
                boxShadow: "0 40px 90px -30px rgba(0,0,0,0.75)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "16px 22px",
                  borderBottom: `1px solid #1b2130`,
                }}
              >
                <div
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: "#3a4252",
                  }}
                />
                <div style={{ color: RAIL, fontSize: 17, fontFamily: MONO }}>
                  ~/spire
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 15,
                  padding: "24px 24px 26px",
                  fontFamily: MONO,
                  fontSize: 20,
                }}
              >
                {TERMINAL_LINES.map((line, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        width: 16,
                        color: line.glyphColor,
                        display: "flex",
                      }}
                    >
                      {line.glyph}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {line.segs.map((seg, j) => (
                        <div key={j} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ color: seg.c }}>{seg.t}</span>
                          {seg.caret ? (
                            <div
                              style={{
                                width: 10,
                                height: 22,
                                borderRadius: 2,
                                background: ACCENT,
                              }}
                            />
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Value props. */}
          <div style={{ display: "flex", gap: 12 }}>
            <Chip label="no account" />
            <Chip label="no install" />
            <Chip label="syntax-highlighted" />
            <Chip label="rewind any save" />
          </div>
        </div>
      </div>
    ),
    size
  );
}
