import { computeNatalChart, computeTransits, signForLongitude } from "./chart";
import type {
  BirthProfile,
  DailyReading,
  LifeArea,
  NatalChart,
  ReadingProvenance,
  ReadingProvenanceInput,
} from "./types";

export const RULESET_VERSION = "2026-10.1";
export const COPY_VERSION = "2026-10.1";
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

const DOS_BY_AREA: Record<LifeArea, string[]> = {
  love: ["Say the warm thing out loud.", "Plan one small ritual together."],
  work: ["Ship the smallest useful version.", "Ask the question you've been avoiding."],
  money: ["Review one recurring charge.", "Delay one non-essential purchase."],
  home: ["Fix the small thing that keeps nagging you."],
  family: ["Check in without an agenda."],
  friends: ["Reach out first.", "Make one plan with a friend this week."],
  self: ["Take ten unhurried minutes for yourself.", "Write down what you want next."],
};

const DONTS: string[] = [
  "Don't mistake urgency for importance.",
  "Don't relitigate a decision that's already made.",
  "Don't answer messages while you're angry.",
  "Don't promise more than tonight-you can deliver.",
  "Don't compare your chapter three to someone's chapter ten.",
];

const AREA_BY_SIGN: Record<string, LifeArea> = {
  aries: "self", taurus: "money", gemini: "friends", cancer: "home",
  leo: "love", virgo: "work", libra: "love", scorpio: "money",
  sagittarius: "friends", capricorn: "work", aquarius: "friends", pisces: "self",
};

function uncertaintyFor(profile: BirthProfile): string {
  switch (profile.birthTimePrecision) {
    case "exact":
      return "Calculated from your exact birth time. House-sensitive details are reliable.";
    case "approximate":
      return "Your birth time is approximate. Sign placements are solid; house details may shift.";
    case "unknown":
      return "No birth time was given. Your Moon sign and all house placements could differ from what's shown. Noon was used as a neutral placeholder.";
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

  // Theme 2: strongest fast transit (mercury..mars) to a natal personal planet
  const fastTransits = transits.filter(
    (t) => ["mercury", "venus", "mars"].includes(t.planet) && t.natalAspects.length > 0,
  );
  const chosen = fastTransits[seed % Math.max(fastTransits.length, 1)];
  if (chosen) {
    const a = chosen.natalAspects[0];
    inputs.push({ kind: "transit", planet: chosen.planet, sign: chosen.sign, natal: a.natal });
    if (chosen.planet === "mercury" && chosen.retrograde) {
      themes.push(pick(HEADLINES["mercury+retrograde"], seed >> 3));
      themes.push(EXPLANATIONS["mercury+retrograde"]);
    } else {
      themes.push(
        `${cap(chosen.planet)} in ${cap(chosen.sign)} is ${a.type.replace("conjunction", "aligning with").replace("opposition", "facing")} your natal ${cap(a.natal)}. Expect that part of life to be louder today.`,
      );
    }
  }

  // Life areas: from the day's dominant signs
  const areas = new Set<LifeArea>();
  areas.add(AREA_BY_SIGN[sun.sign]);
  if (chosen) areas.add(AREA_BY_SIGN[chosen.sign]);
  const phase = lunarPhase(now);
  inputs.push({ kind: "lunar_phase", phase });
  if (phase === "full moon") areas.add("love");
  if (chosen?.planet === "mars") areas.add("work");

  const areaList = [...areas].filter(Boolean).slice(0, 3);

  const dos: string[] = [];
  for (const area of areaList) {
    const opts = DOS_BY_AREA[area];
    dos.push(pick(opts, seed >> (dos.length + 1)));
  }
  // Always deliver three dos: pad from the general pool, skipping duplicates.
  const generalPool = [
    ...DOS_BY_AREA.self, ...DOS_BY_AREA.work, ...DOS_BY_AREA.friends,
  ];
  let pad = 0;
  while (dos.length < 3 && pad < generalPool.length * 2) {
    const candidate = pick(generalPool, (seed >> (pad + 3)) + pad * 7);
    if (!dos.includes(candidate)) dos.push(candidate);
    pad++;
  }
  while (dos.length < 3) {
    dos.push(pick(DOS_BY_AREA.self, dos.length + seed));
  }

  const donts = [
    pick(DONTS, seed >> 2),
    pick(DONTS, seed >> 4),
    pick(DONTS, seed >> 6),
  ];
  const uniqueDonts = [...new Set(donts)];

  const headline = themes[0];
  const explanation = themes.slice(1).join(" ") || DEFAULT_HEADLINES[0];

  const provenance: ReadingProvenance = {
    rulesetVersion: RULESET_VERSION,
    copyVersion: COPY_VERSION,
    ephemerisName: EPHEMERIS_NAME,
    ephemerisVersion: EPHEMERIS_VERSION,
    selectedEvents: chosen ? [{ kind: "transit", planet: chosen.planet, sign: chosen.sign, natal: chosen.natalAspects[0].natal }] : [],
    calculatedAt: now.toISOString(),
    inputs,
  };

  return {
    id: `${forDate}`,
    forDate,
    headline,
    explanation,
    dos,
    donts: uniqueDonts,
    lifeAreas: areaList,
    provenance,
    uncertaintyNote: uncertaintyFor(profile),
  };
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
