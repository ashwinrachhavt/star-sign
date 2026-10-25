/**
 * Astrological glyphs (design-system.md §1.6 — "glyphs as language").
 * Single source for body, aspect, and sign glyphs; mono-voice text uses
 * these inline. All 10 bodies + 5 aspects (ASH-254 AC2).
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

export const SIGN_GLYPHS: Record<string, string> = {
  aries: "♈",
  taurus: "♉",
  gemini: "♊",
  cancer: "♋",
  leo: "♌",
  virgo: "♍",
  libra: "♎",
  scorpio: "♏",
  sagittarius: "♐",
  capricorn: "♑",
  aquarius: "♒",
  pisces: "♓",
};

export function bodyGlyph(planet: string): string {
  return BODY_GLYPHS[planet] ?? "•";
}

export function aspectGlyph(aspect: string): string {
  return ASPECT_GLYPHS[aspect] ?? "·";
}

export function signGlyph(sign: string): string {
  return SIGN_GLYPHS[sign] ?? "·";
}

const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

function monthDay(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/**
 * Date-range formatting per design-system §5 (ref 12.png): mono caps,
 * em-dash separator — "OCTOBER 23—NOVEMBER 7". A single-day range
 * renders as just the one date ("OCTOBER 23").
 */
export function dateRangeLabel(start: string, end?: string): string {
  if (!end || end === start) return monthDay(start);
  return `${monthDay(start)}—${monthDay(end)}`;
}
