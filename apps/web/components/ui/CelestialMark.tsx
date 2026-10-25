import { fontMono } from "@/app/fonts";

/**
 * CelestialMark (design-system imagery rule): a decorative mark from the
 * in-house celestial icon set (public/celestial/*) — moon phases, star
 * bursts, orbits. Ink-colored (#e8e6e1), transparent, pure decoration:
 * aria-hidden everywhere. Deterministic per-key selection via a stable
 * hash so a given surface always shows the same mark.
 */
const CATALOG = Array.from(
  { length: 30 },
  (_, i) => `/celestial/icon-${String(i).padStart(2, "0")}.png`,
);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function CelestialMark({
  seed,
  index,
  size = 56,
  className,
  style,
}: {
  /** Deterministic pick from the catalog when no explicit index. */
  seed?: string;
  /** Explicit icon index (0–29). */
  index?: number;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const pick =
    index !== undefined
      ? index
      : seed
        ? hash(seed) % CATALOG.length
        : 0;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={CATALOG[pick % CATALOG.length]}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`ui-celestial-mark${className ? ` ${className}` : ""}`}
      style={{ objectFit: "contain", pointerEvents: "none", ...style }}
      loading="lazy"
      decoding="async"
    />
  );
}
