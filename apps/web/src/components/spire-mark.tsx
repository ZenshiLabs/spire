import type { SVGProps } from "react";

type SpireMarkProps = Omit<SVGProps<SVGSVGElement>, "title"> & {
  /** Pixel size applied to both width and height. Default 24. */
  size?: number;
  /** Render the rounded brand tile behind the mark (self-contained app icon). */
  filled?: boolean;
  /** Colour of the highlighted "latest checkpoint" plate. */
  accentColor?: string;
  /** Tile background colour — only used when `filled`. */
  tileColor?: string;
  /** Accessible label. Omit for a decorative icon (renders `aria-hidden`). */
  title?: string;
};

/**
 * Spire brand mark — three checkpoint plates twisting upward through time, the
 * latest one accented (the "live" save). Pure inline SVG, no asset import.
 *
 * Dual-tone + theme-aware: the two base plates paint with `currentColor`, so the
 * glyph inverts automatically between light and dark — colour it with a Tailwind
 * `text-*` class or any CSS colour. The accent plate keeps the brand hue
 * (override globally with `--spire-accent`, or per-instance via `accentColor`).
 *
 * Pass `filled` for the app-icon lockup (rounded tile + white plates). That
 * variant is mirrored by the favicon at `src/app/icon.svg`.
 */
export function SpireMark({
  size = 24,
  filled = false,
  accentColor = "var(--spire-accent, oklch(0.5513 0.2473 265.85))",
  tileColor = "var(--spire-tile, oklch(0.1767 0.0114 260.64))",
  title,
  ...props
}: SpireMarkProps) {
  const base = filled ? "oklch(1 0 0)" : "currentColor";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {filled ? (
        <rect x="1" y="1" width="46" height="46" rx="11" fill={tileColor} />
      ) : null}
      <rect
        x="12"
        y="30"
        width="24"
        height="7"
        rx="3.5"
        fill={base}
        transform="rotate(6 24 33.5)"
      />
      <rect
        x="13"
        y="20"
        width="22"
        height="7"
        rx="3.5"
        fill={base}
        transform="rotate(-6 24 23.5)"
      />
      <rect
        x="14"
        y="10"
        width="20"
        height="7"
        rx="3.5"
        fill={accentColor}
        transform="rotate(6 24 13.5)"
      />
    </svg>
  );
}
