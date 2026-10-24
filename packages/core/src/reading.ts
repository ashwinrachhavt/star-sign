import { computeNatalChart, computeTransits } from "./chart";
import {
  dontsForEvents,
  dosForEvents,
  explanationForEvent,
  rankLifeAreas,
  scoreTransitEvents,
  type TransitEvent,
} from "./ruleset";
import type {
  BirthProfile,
  DailyReading,
  LifeArea,
  NatalChart,
  ReadingProvenance,
  ReadingProvenanceInput,
} from "./types";

export const RULESET_VERSION = "2026-10.2";
export const COPY_VERSION = "2026-10.2";
export const EPHEMERIS_NAME = "astronomy-engine";
export const EPHEMERIS_VERSION = "2.1.19";

/**
 * Copy packs are the only source of interpretation language. They are
 * versioned so any persisted reading can be traced to the exact text set
 * that produced it. This pack is original writing for Star Sign.
 */
const HEADLINES: Record<string, string[]> = {
  "sun+aries": ["Lead before you explain yourself.", "Start the thing. Tune it later."],
  "sun+taurus": ["Slow is a strategy today.", "Protect what you already built."],
  "moon+cancer": ["Feelings get a vote, not the wheel.", "Home base needs attention."],
  "mercury+retrograde": ["Say it twice. Confirm it once more.", "Re-read before you hit send."],
  "venus+libra": ["Charm opens doors; honesty keeps them open.", "Ask for what you actually want."],
  "mars+capricorn": ["Ambition wears work clothes today.", "One hard thing, done well."],
};

const DEFAULT_HEADLINES = [
  "The sky is quiet. Make your own weather.",
  "Small moves compound today.",
  "Pay attention to what repeats.",
];

const EXPLANATIONS: Record<string, string> = {
  "sun+aries": "With the Sun in Aries, initiative is cheaper than usual. What you begin now carries your signature.",
  "moon+cancer": "The Moon in Cancer pulls attention toward home and the people who feel like it.",
  "mercury+retrograde": "Mercury retrograde favors revision over launches. Contracts, messages, and plans deserve a second pass.",
};

function uncertaintyFor(profile: BirthProfile): string {
  const method = `Positions are calculated with the ${EPHEMERIS_NAME} astronomical library (v${EPHEMERIS_VERSION}).`;
  switch (profile.birthTimePrecision) {
    case "exact":
      return `Calculated from your exact birth time. House-sensitive details are reliable. ${method}`;
    case "approximate":
      return `Your birth time is approximate. Sign placements are solid; house details may shift. ${method}`;
    case "unknown":
      return `No birth time was given. Your Moon sign and all house placements could differ from what's shown. Noon was used as a neutral placeholder. ${method}`;
  }
}

function pick<T>(arr: T[], seed: number): T {
  // Bitwise shifts on seeds ≥ 2^31 yield negatives; normalize the index.
  const i = ((Math.trunc(seed) % arr.length) + arr.length) % arr.length;
  return arr[i];
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function lunarPhase(date: Date): string {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const phase = ((jd - 2451550.1) / 29.530588853) % 1;
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.03 || p > 0.97) return "new moon";
  if (p < 0.22) return "waxing crescent";
  if (p < 0.28) return "first quarter";
  if (p < 0.47) return "waxing gibbous";
  if (p < 0.53) return "full moon";
  if (p < 0.72) return "waning gibbous";
  if (p < 0.78) return "last quarter";
  return "waning crescent";
}

export interface GenerateDailyReadingArgs {
  profile: BirthProfile;
  /** User's local calendar date, e.g. "2026-10-24" */
  forDate: string;
  now?: Date;
}

function eventToInput(e: TransitEvent): ReadingProvenanceInput {
  return {
    kind: "transit",
    planet: e.transit,
    sign: e.transitSign ?? "aries",
    natal: e.natal,
    aspect: e.type,
  };
}

/**
 * Deterministic: same profile + date + ruleset version produce the same
 * reading. Idempotency lives with the caller (unique constraint on
 * (user_id, for_date)), retry-safe by construction.
 */
export function generateDailyReading(
  args: GenerateDailyReadingArgs,
): DailyReading {
  const { profile, forDate } = args;
  const now = args.now ?? resolveNoonLocal(profile.birthTimeZone, forDate);
  const chart: NatalChart = computeNatalChart(profile);
  const transits = computeTransits(chart, now);

  const inputs: ReadingProvenanceInput[] = [];
  const themes: string[] = [];

  const sun = chart.placements.find((p) => p.planet === "sun")!;
  const moon = chart.placements.find((p) => p.planet === "moon")!;
  inputs.push({ kind: "natal_placement", planet: "sun", sign: sun.sign });
  inputs.push({ kind: "natal_placement", planet: "moon", sign: moon.sign });

  const seed = hash(`${profile.birthDate}|${sun.sign}|${forDate}|${RULESET_VERSION}`);

  // Theme 1: natal sun
  themes.push(pick(HEADLINES[`sun+${sun.sign}`] ?? DEFAULT_HEADLINES, seed));
  const sunExplanation = EXPLANATIONS[`sun+${sun.sign}`];
  if (sunExplanation) themes.push(sunExplanation);

  // 3.1a/b: all interpretation is driven by scored transit events.
  const signOf = new Map(transits.map((t) => [t.planet, t.sign]));
  const events = scoreTransitEvents(transits).map((e) => ({
    ...e,
    transitSign: signOf.get(e.transit),
  }));

  const phase = lunarPhase(now);
  inputs.push({ kind: "lunar_phase", phase });

  // Strongest event becomes the transit theme (headline candidate +
  // explanation line) and is recorded first in selectedEvents.
  const chosen = events[0];
  if (chosen) {
    inputs.push(eventToInput(chosen));
    if (chosen.transit === "mercury" && chosen.retrograde) {
      themes.push(pick(HEADLINES["mercury+retrograde"], seed >> 3));
      themes.push(EXPLANATIONS["mercury+retrograde"]);
    } else {
      themes.push(explanationForEvent(chosen));
    }
  }

  // Life areas: ranked hot/warm/quiet from summed event scores, not sun
  // signs (criterion 1: different charts → different rankings).
  const ranked = rankLifeAreas(events);
  const areaList = ranked.slice(0, 3).map((r) => r.area);

  // 3.1b: dos/don'ts are selected by event themes — every item traces to
  // a real event in selectedEvents (criterion 2). On quiet days the lists
  // are intentionally shorter; no generic padding breaks traceability.
  const selectedEvents = events.slice(0, 5);
  const dos = dosForEvents(selectedEvents).slice(0, 3);
  const donts = dontsForEvents(selectedEvents).slice(0, 3);

  const headline = themes[0];
  const explanation = themes.slice(1).join(" ") || DEFAULT_HEADLINES[0];

  // Houses, when known (exact birth time), ground the reading in life
  // domains; they never appear for approximate/unknown times (never
  // guessed). Appended to the explanation as a house line.
  const sunHouse = sun.house;
  const houseLine =
    sunHouse !== undefined
      ? ` Your Sun in the ${ordinal(sunHouse)} house colors where this lands today.`
      : "";

  const provenance: ReadingProvenance = {
    rulesetVersion: RULESET_VERSION,
    copyVersion: COPY_VERSION,
    ephemerisName: EPHEMERIS_NAME,
    ephemerisVersion: EPHEMERIS_VERSION,
    selectedEvents: selectedEvents.map(eventToInput),
    calculatedAt: now.toISOString(),
    inputs,
  };

  return {
    id: `${forDate}`,
    forDate,
    headline,
    explanation: explanation + houseLine,
    dos,
    donts,
    lifeAreas: areaList,
    provenance,
    uncertaintyNote: uncertaintyFor(profile),
  };
}

const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
function ordinal(n: number): string {
  return ORDINALS[n] ?? `${n}th`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function resolveNoonLocal(timeZone: string, forDate: string): Date {
  const [y, m, d] = forDate.split("-").map(Number);
  // Local noon → UTC via two-pass offset resolution (mirrors chart.ts)
  const guess = Date.UTC(y, m - 1, d, 12, 0);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const offset = (date: Date) => {
    const parts = dtf.formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return (Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second")) - date.getTime()) / 60000;
  };
  const o1 = offset(new Date(guess));
  const o2 = offset(new Date(guess - o1 * 60000));
  return new Date(guess - o2 * 60000);
}
