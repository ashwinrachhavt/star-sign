/**
 * Astrological glyphs (design-system.md §1.6) — RN mirror of
 * apps/web/components/ui/glyphs.ts. All 10 bodies + 5 aspects (ASH-254 AC2).
 */

export const BODY_GLYPHS: Record<string, string> = {
  sun: "☉",
  moon: "☽",
  mercury: "☿",
  venus: "♀",
  mars: "♂",
  jupiter: "♃",
  saturn: "♄",
  uranus: "♅",
  neptune: "♆",
  pluto: "♇",
};

export const ASPECT_GLYPHS: Record<string, string> = {
  conjunction: "☌",
  opposition: "☍",
  square: "□",
  trine: "△",
  sextile: "⚹",
};

export function bodyGlyph(planet: string): string {
  return BODY_GLYPHS[planet] ?? "•";
}

export function aspectGlyph(aspect: string): string {
  return ASPECT_GLYPHS[aspect] ?? "·";
}

const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

function monthDay(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/** Mono caps, em-dash format per §5 (ref 12.png). */
export function dateRangeLabel(start: string, end?: string): string {
  if (!end || end === start) return monthDay(start);
  return `${monthDay(start)}—${monthDay(end)}`;
}
