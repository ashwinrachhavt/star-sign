import { computeNatalChart, computeTransits } from "./chart";
import {
  dontsForEvents,
  dosForEvents,
  explanationForEvent,
  rankLifeAreas,
  scoreTransitEvents,
  type TransitEvent,
} from "./ruleset";
import { recommendForEvents } from "./recommendations";
import type {
  BirthProfile,
  DailyReading,
  DiveDeeper,
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
/**
 * Headline templates keyed to transit events (aspect family × theme), not
 * sun signs — ASH-247. The day's actual sky picks the line; the natal sign
 * only breaks ties when no fast transit qualifies. Key: `${planet}+${aspect}`
 * (or `${planet}+retrograde`), evaluated in fast-first order
 * (mercury → venus → mars). All lines ≤12 words, copy.md voice: second
 * person, declarative, concrete, no certainty inflation, no fear-mongering.
 */
const TRANSIT_HEADLINES: Record<string, string[]> = {
  "mercury+retrograde": [
    "Say it twice. Confirm it once more.",
    "Re-read before you hit send.",
    "The message can wait until it's right.",
  ],
  "mercury+conjunction": ["Say the thing you've been rehearsing.", "One honest sentence opens the day."],
  "mercury+sextile": ["The ask is easier than you think.", "Send it. See what comes back."],
  "mercury+square": ["Say less. Mean more.", "The wrong words cost more than silence today."],
  "mercury+trine": ["Talk it through — the words arrive easily.", "A conversation moves something stuck."],
  "mercury+opposition": ["Hear them out before you answer.", "The other side has a point today."],
  "venus+conjunction": ["What you want is closer than it looks.", "Let yourself be seen today."],
  "venus+sextile": ["Make the warm gesture first.", "Beauty earns its keep today. Use it."],
  "venus+square": ["Wanting and having argue. Don't referee.", "Spend on what lasts, not what shines."],
  "venus+trine": ["Give the affection you've been saving.", "Pleasure is on the schedule today."],
  "venus+opposition": ["Name what you need out loud.", "Meet them halfway — then say so."],
  "mars+conjunction": ["Pick your moment and move.", "The door is open. Walk through it."],
  "mars+sextile": ["Start before you feel ready.", "One decisive move beats three careful ones."],
  "mars+square": ["Push, but pick the door that opens.", "Friction is information. Adjust grip, not goal."],
  "mars+trine": ["Your effort pays same-day today.", "Do the hard thing while it's easy."],
  "mars+opposition": ["The resistance is the workout.", "Stand your ground without raising your voice."],
};

/** Fallback only when no fast transit qualifies — the quiet-sky line. */
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

/** Headline quality bar (copy.md): hard ceiling of 12 words, generator-enforced. */
const HEADLINE_MAX_WORDS = 12;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function enforceWordLimit(headline: string): string {
  if (wordCount(headline) <= HEADLINE_MAX_WORDS) return headline;
  const sentences = headline.match(/[^.!?]+[.!?]+/g) ?? [headline];
  const fits = sentences.map((s) => s.trim()).filter((s) => wordCount(s) > 0 && wordCount(s) <= HEADLINE_MAX_WORDS);
  if (fits.length > 0) return fits[0];
  return headline.split(/\s+/).slice(0, HEADLINE_MAX_WORDS).join(" ");
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
    orb: e.orb,
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

  const sunExplanation = EXPLANATIONS[`sun+${sun.sign}`];

  // 3.1a/b: all interpretation is driven by scored transit events.
  const signOf = new Map(transits.map((t) => [t.planet, t.sign]));
  const events = scoreTransitEvents(transits).map((e) => ({
    ...e,
    transitSign: signOf.get(e.transit),
  }));

  const phase = lunarPhase(now);
  inputs.push({ kind: "lunar_phase", phase });

  // Strongest event becomes the transit theme: a transit-driven headline
  // (ASH-247, keyed planet+aspect — retrograde Mercury gets its own pool)
  // plus the explanation line. The same event is recorded first in
  // selectedEvents, so headline ↔ provenance always correlate (criterion 2).
  const chosen = events[0];
  let headline: string;
  if (chosen) {
    inputs.push(eventToInput(chosen));
    const key =
      chosen.transit === "mercury" && chosen.retrograde
        ? "mercury+retrograde"
        : `${chosen.transit}+${chosen.type}`;
    const pool = TRANSIT_HEADLINES[key] ?? DEFAULT_HEADLINES;
    headline = enforceWordLimit(pick(pool, seed >> 3));
    if (chosen.transit === "mercury" && chosen.retrograde) {
      themes.push(EXPLANATIONS["mercury+retrograde"]);
    } else {
      themes.push(explanationForEvent(chosen));
    }
  } else {
    // No qualifying transit: natal fallback, still word-limited.
    headline = enforceWordLimit(pick(DEFAULT_HEADLINES, seed >> 3));
  }
  if (sunExplanation) themes.push(sunExplanation);

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

  // Dive deeper v1 (ASH-249): built from the same selected events the
  // provenance records — no dive content exists without full provenance
  // (criterion 3). On quiet days (no events) the section is omitted
  // entirely rather than filled with generic content.
  const diveDeeper = buildDiveDeeper(selectedEvents, phase, seed);

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
    diveDeeper,
  };
}

/**
 * Decode-the-day + lessons (ASH-249). Every decode line pairs the stored
 * provenance input with its plain-language explanation and live geometry
 * (aspect + orb + retrograde phase — criterion 1). Lessons are reflective,
 * longer-form, and invite returning (criterion 2, copy.md dive register).
 */
function buildDiveDeeper(
  events: TransitEvent[],
  phase: string,
  seed: number,
): DiveDeeper | undefined {
  if (events.length === 0) return undefined;

  const decoded = events.map((e) => ({
    event: eventToInput(e),
    explanation: explanationForEvent(e),
    geometry:
      `${cap(e.transit)}${e.retrograde ? " retrograde" : ""} ` +
      `${e.type} natal ${cap(e.natal)}, orb ${e.orb.toFixed(1)}°`,
  }));

  const lessons = lessonsFor(events, phase);
  // "For you today" (ASH-264): theme-matched only — absent when nothing
  // in the dataset matches (never filler, criterion 2).
  const recommendations = recommendForEvents(events, seed, 3).map((r) => ({
    kind: r.item.kind,
    title: r.item.title,
    creator: r.item.creator,
    blurb: r.item.blurb,
    url: r.item.url,
    matchedEvent: r.matchedEvent,
  }));
  return { decoded, lessons, ...(recommendations.length > 0 ? { recommendations } : {}) };
}

/**
 * Lessons of the day: reflective, grounded in the day's actual event
 * mix — never predictive, never certain (copy.md). Invites returning.
 */
function lessonsFor(events: TransitEvent[], phase: string): string {
  const harmonious = events.filter((e) => e.type === "trine" || e.type === "sextile").length;
  const frictional = events.filter((e) => e.type === "square" || e.type === "opposition").length;
  const retrogrades = events.filter((e) => e.retrograde).length;
  const strongest = events[0];

  const lines: string[] = [];

  if (frictional > harmonious) {
    lines.push(
      "Today leans toward friction, and friction is information. The places that snag are usually the ones asking a question you've been deferring — not to answer it all at once, but to notice you were asked.",
    );
  } else if (harmonious > 0) {
    lines.push(
      "Today's currents run with you more than against you. Easy days are easy to spend without keeping anything — the lesson is to let what flows teach you what you actually want, while nothing is demanding it.",
    );
  } else {
    lines.push(
      "The sky is quiet today, and quiet is not empty. Days like this are where the slower material settles — what moved last week keeps moving inside you at its own pace.",
    );
  }

  if (retrogrades > 0) {
    lines.push(
      "With a planet moving backward in your sky, the forward step today is the review, not the launch. Rereading, revisiting, revising — these count as motion.",
    );
  }

  lines.push(
    `The loudest thread today is ${cap(strongest.transit)} touching your natal ${cap(strongest.natal)} — worth returning to tonight, when the day has told you what it was about.`,
  );
  if (phase === "full moon") {
    lines.push(
      "It's a full moon: things peak and names get said. Notice what crested today; it was building for a while.",
    );
  } else if (phase === "new moon") {
    lines.push(
      "It's a new moon: the page is blank on purpose. Small intentions set now are easier to keep than large ones declared now.",
    );
  }

  return lines.join(" ");
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
