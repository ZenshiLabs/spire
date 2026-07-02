import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Spire — Live code sharing without a screen share";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Social share card. Rendered at build/request time by Satori, so it uses plain
 * flexbox divs rather than the SVG brand mark. Next serves this for both the
 * Open Graph and Twitter (summary_large_image) previews.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0e1116",
          color: "#f4f6fb",
          padding: 80,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#2d5bff",
            }}
          />
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
            Spire
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 900,
            }}
          >
            Live code sharing without a screen share
          </div>
          <div style={{ fontSize: 30, color: "#9aa4b2", maxWidth: 860 }}>
            Run one command, share the link — anyone can follow along as you
            save. Read-only, no account, no install.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "20px 28px",
            borderRadius: 14,
            background: "#171b22",
            border: "1px solid rgba(255,255,255,0.08)",
            fontFamily: "monospace",
            fontSize: 30,
          }}
        >
          <span style={{ color: "#2d5bff" }}>$</span>
          <span>npx @zenshilabs/spire start</span>
        </div>
      </div>
    ),
    size,
  );
}
