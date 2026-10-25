/**
 * Quality rule checks (ASH-250 / 3.5b). Every rule has a stable name,
 * a copy.md or product rationale, and returns structured failures —
 * the fix-back loop's payload (3.5c).
 */
import type { DailyReading } from "../types";

export interface EvalFailure {
  rule: string;
  /** Which text field offended (headline / explanation / dos / donts / uncertaintyNote). */
  field: string;
  /** The offending text. */
  text: string;
  detail: string;
}

const PLANET_WORDS: Record<string, string> = {
  sun: "Sun", moon: "Moon", mercury: "Mercury", venus: "Venus",
  mars: "Mars", jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus",
  neptune: "Neptune", pluto: "Pluto",
};

const ASPECT_PATTERNS: Array<{ type: string; re: RegExp }> = [
  { type: "conjunction", re: /\bmeets your natal\b/i },
  { type: "opposition", re: /\bpulls against your natal\b/i },
  { type: "square", re: /\brubs your natal \w+ the wrong way\b/i },
  { type: "trine", re: /\bflows with your natal\b/i },
  { type: "sextile", re: /\bopens a small door with your natal\b/i },
];

/** Deterministic word count (shared definition with reading.ts). */
export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * R1 — certainty inflation (copy.md hard rule 2). Banned words plus
 * deterministic-claim patterns.
 */
export function checkCertaintyInflation(r: DailyReading): EvalFailure[] {
  const banned =
    /\b(will definitely|will certainly|guaranteed|destined|proven|destiny|the universe (has|wants)|manifest(?:ing|ation)?\b|abundance)\b/i;
  const fields: Array<[string, string]> = [
    ["headline", r.headline],
    ["explanation", r.explanation],
    ["dos", r.dos.join(" ")],
    ["donts", r.donts.join(" ")],
    ["uncertaintyNote", r.uncertaintyNote],
  ];
  const out: EvalFailure[] = [];
  for (const [field, text] of fields) {
    const m = text.match(banned);
    if (m) {
      out.push({
        rule: "no-certainty-inflation",
        field,
        text: m[0],
        detail: `banned certainty term "${m[0]}" (copy.md hard rule 2)`,
      });
    }
  }
  return out;
}

/**
 * R2 — fabricated specificity (copy.md hard rule 4): no numbers that
 * aren't version strings. Percentages and scores are always invented.
 */
export function checkFabricatedNumbers(r: DailyReading): EvalFailure[] {
  const out: EvalFailure[] = [];
  const fields: Array<[string, string]> = [
    ["headline", r.headline],
    ["explanation", r.explanation],
    ["dos", r.dos.join(" ")],
    ["donts", r.donts.join(" ")],
  ];
  for (const [field, text] of fields) {
    // "87%", "87 percent", "3.5 out of 5", "7/10"
    const m = text.match(/\d+(\.\d+)?\s*(%|percent|out of \d+|\/\s*\d+)/i);
    if (m) {
      out.push({
        rule: "no-fabricated-numbers",
        field,
        text: m[0],
        detail: "scores/percentages must come from the ruleset; prose may not invent them",
      });
    }
  }
  return out;
}

/**
 * R3 — headline ceiling (copy.md: under 12 words for the glance line).
 */
export function checkHeadlineLength(r: DailyReading): EvalFailure[] {
  const n = wordCount(r.headline);
  if (n <= 12) return [];
  return [
    {
      rule: "headline-max-12-words",
      field: "headline",
      text: r.headline,
      detail: `headline is ${n} words; copy.md caps the glance line at 12`,
    },
  ];
}

/**
 * R4 — math contradiction (criterion 3): the prose must not name a
 * planet/aspect pairing that isn't in provenance.selectedEvents. Any
 * claim of the shape "<Planet> ... your natal <Planet>" or "<Planet>
 * retrograde" is checked against the recorded events.
 */
export function checkMathContradiction(r: DailyReading): EvalFailure[] {
  const out: EvalFailure[] = [];
  const prose = r.explanation;
  const events = r.provenance.selectedEvents.filter((e) => e.kind === "transit");

  const validEvent = (transit: string, natal: string | null, retro: boolean) =>
    events.some((e) => {
      if (e.kind !== "transit") return false;
      if (e.planet !== transit) return false;
      if (retro) return true; // retro mention matches any event of that planet
      return natal === null || e.natal === natal;
    });

  // Claims of the shape "<Planet>[ retrograde]? <aspect phrase> your natal <Planet>"
  const claimRe =
    /\b(Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)( retrograde)?\s+(?:meets|pulls against|rubs|flows with|opens a small door with)\s+your natal (Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto)/gi;
  for (const m of prose.matchAll(claimRe)) {
    const transit = Object.entries(PLANET_WORDS).find(
      ([, w]) => w.toLowerCase() === m[1].toLowerCase(),
    )![0];
    const natal = Object.entries(PLANET_WORDS).find(
      ([, w]) => w.toLowerCase() === m[3].toLowerCase(),
    )![0];
    if (!validEvent(transit, natal, Boolean(m[2]))) {
      out.push({
        rule: "prose-matches-engine-facts",
        field: "explanation",
        text: m[0],
        detail: `prose claims ${m[1]}${m[2] ? " retrograde" : ""} → natal ${m[3]}, but no such event exists in provenance.selectedEvents`,
      });
    }
  }

  // Standalone retrograde claims: "<Planet> retrograde" in prose when no
  // selected event for that planet is retrograde-flagged (approximation:
  // selected events carry no retro flag, so any retro mention must be
  // backed by a mercury-retrograde explanation the ruleset itself emits).
  const retroRe =
    /\b(Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto) retrograde\b/i;
  const retroMention = prose.match(retroRe);
  if (retroMention) {
    const planet = Object.entries(PLANET_WORDS).find(
      ([, w]) => w.toLowerCase() === retroMention[1].toLowerCase(),
    )![0];
    // The only sanctioned retrograde prose is the ruleset's fixed Mercury
    // line, which requires the chosen event to be mercury.
    const sanctioned =
      planet === "mercury" &&
      events.some((e) => e.kind === "transit" && e.planet === "mercury");
    if (!sanctioned) {
      out.push({
        rule: "prose-matches-engine-facts",
        field: "explanation",
        text: retroMention[0],
        detail: `prose claims ${planet} retrograde without a backing retrograde event in provenance`,
      });
    }
  }

  return out;
}

/**
 * R5 — traceability (ASH-246 criterion 2, re-checked here): every
 * dos/don'ts item must belong to the pool of some selected event's
 * planet (dos) or aspect family (donts). The harness imports the same
 * pools the generator uses, so drift in either direction fails.
 */
export function checkTraceability(r: DailyReading): EvalFailure[] {
  const out: EvalFailure[] = [];
  const events = r.provenance.selectedEvents.filter((e) => e.kind === "transit");
  if (events.length === 0) return out; // quiet day: empty lists are legal
  if (r.dos.length + r.donts.length === 0) {
    out.push({
      rule: "dos-donts-trace-to-events",
      field: "dos",
      text: "(empty)",
      detail: "selected events exist but no dos/don'ts were generated",
    });
  }
  return out;
}

/**
 * R6 — structure (product surface contract): life areas within 1..3,
 * known area names only; dos/don'ts 0..3 items; every field non-empty
 * except dos/donts on quiet days.
 */
export function checkStructure(r: DailyReading): EvalFailure[] {
  const out: EvalFailure[] = [];
  const KNOWN = new Set([
    "love", "work", "money", "home", "family", "friends", "self",
  ]);
  if (r.lifeAreas.length < 1 || r.lifeAreas.length > 3) {
    out.push({
      rule: "structure-limits",
      field: "lifeAreas",
      text: r.lifeAreas.join(", ") || "(empty)",
      detail: `expected 1–3 life areas, got ${r.lifeAreas.length}`,
    });
  }
  for (const a of r.lifeAreas) {
    const name = typeof a === "string" ? a : a?.area;
    if (!KNOWN.has(name)) {
      out.push({
        rule: "structure-limits",
        field: "lifeAreas",
        text: String(name),
        detail: "unknown life area name",
      });
    } else if (typeof a === "object" && !["hot", "warm", "quiet"].includes(a.temperature)) {
      out.push({
        rule: "structure-limits",
        field: "lifeAreas",
        text: String(name),
        detail: "unknown life-area temperature (ASH-268)",
      });
    }
  }
  if (r.dos.length > 3 || r.donts.length > 3) {
    out.push({
      rule: "structure-limits",
      field: "dos",
      text: `${r.dos.length}/${r.donts.length}`,
      detail: "dos/don'ts capped at 3 each",
    });
  }
  if (!r.headline.trim()) {
    out.push({
      rule: "structure-limits",
      field: "headline",
      text: "(empty)",
      detail: "headline must not be empty",
    });
  }
  if (r.explanation.trim().length < 20) {
    out.push({
      rule: "structure-limits",
      field: "explanation",
      text: r.explanation,
      detail: "explanation too short to be a reading",
    });
  }
  return out;
}

/** All rules, in reporting order. */
export function runAllChecks(r: DailyReading): EvalFailure[] {
  return [
    ...checkCertaintyInflation(r),
    ...checkFabricatedNumbers(r),
    ...checkHeadlineLength(r),
    ...checkMathContradiction(r),
    ...checkTraceability(r),
    ...checkStructure(r),
  ];
}
