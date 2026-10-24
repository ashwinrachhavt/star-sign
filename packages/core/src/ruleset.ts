/**
 * Transit-driven interpretation ruleset (ASH-246 / 3.1a).
 *
 * Maps real transit events (transiting planet → natal target, with aspect
 * type) to life areas and copy themes. Life-area rankings are grounded in
 * event scores, not sun signs. Deterministic: same events + version →
 * same reading.
 *
 * Version discipline (criterion 3): changing any rule or copy string in
 * this file bumps RULESET_VERSION / COPY_VERSION in reading.ts.
 */
import type {
  Aspect,
  LifeArea,
  Planet,
  TransitObservation,
} from "./types";

/** Weight per aspect family. Harmonious and hard aspects both "activate". */
const ASPECT_WEIGHT: Record<Aspect["type"], number> = {
  conjunction: 3,
  opposition: 2.5,
  square: 2.5,
  trine: 2,
  sextile: 1.5,
};

/** Tighter orbs score higher: proximity = urgency. */
function orbFactor(orb: number): number {
  return Math.max(0.5, 1 - orb / 8);
}

/**
 * Event → life-area rules (3.1a): the *transiting* planet sets the theme;
 * the natal target refines it. Multiple areas allowed; the ruleset, not
 * the copy pack, owns this mapping.
 */
const PLANET_AREAS: Record<Planet, LifeArea[]> = {
  sun: ["self"],
  moon: ["home", "family"],
  mercury: ["friends", "work"],
  venus: ["love", "money"],
  mars: ["work", "self"],
  jupiter: ["self", "money"],
  saturn: ["work", "money"],
  uranus: ["friends", "self"],
  neptune: ["self"],
  pluto: ["self"],
};

/** Natal-target refinement: the area of life the *recipient* planet rules. */
const NATAL_TARGET_AREAS: Partial<Record<Planet, LifeArea[]>> = {
  venus: ["love"],
  saturn: ["work"],
  moon: ["home", "family"],
  mercury: ["friends"],
};

export interface TransitEvent {
  transit: Planet;
  natal: Planet;
  type: Aspect["type"];
  orb: number;
  retrograde: boolean;
  areas: LifeArea[];
  /** Event salience: aspect weight × orb proximity × planet speed class. */
  score: number;
  /** Current sign of the transiting planet (filled by the caller). */
  transitSign?: import("./types").ZodiacSign;
}

const PERSONAL_BOOST: Partial<Record<Planet, number>> = {
  sun: 1.2, moon: 1.2, mercury: 1.1, venus: 1.1, mars: 1.1,
};

/**
 * Scores every transit event touching a personal natal target and maps it
 * to life areas. Events are returned sorted by score, strongest first.
 */
export function scoreTransitEvents(
  transits: TransitObservation[],
): TransitEvent[] {
  const events: TransitEvent[] = [];
  for (const t of transits) {
    for (const a of t.natalAspects) {
      // Transits from outer planets to natal outer planets move too slowly
      // to feel "today"; the ruleset keeps events personally resonant by
      // requiring at least one personal planet on either end.
      const personal =
        ["sun", "moon", "mercury", "venus", "mars"].includes(t.planet) ||
        ["sun", "moon", "mercury", "venus", "mars"].includes(a.natal);
      if (!personal) continue;

      const areas = [
        ...new Set([...(PLANET_AREAS[t.planet] ?? []), ...(NATAL_TARGET_AREAS[a.natal] ?? [])]),
      ];
      const score =
        ASPECT_WEIGHT[a.type] *
        orbFactor(a.orb) *
        (PERSONAL_BOOST[t.planet] ?? 1) *
        (t.retrograde ? 1.15 : 1);

      events.push({
        transit: t.planet,
        natal: a.natal,
        type: a.type,
        orb: a.orb,
        retrograde: t.retrograde,
        areas,
        score: Number(score.toFixed(3)),
      });
    }
  }
  return events.sort((x, y) => y.score - x.score);
}

export type AreaTemperature = "hot" | "warm" | "quiet";

/**
 * Ranks life areas by summed event score into hot / warm / quiet
 * (copy.md: never percentages). Hot: clearly dominant; warm: active;
 * quiet: everything else. Ties broken deterministically by area name.
 */
export function rankLifeAreas(
  events: TransitEvent[],
): Array<{ area: LifeArea; temperature: AreaTemperature; score: number }> {
  const scores = new Map<LifeArea, number>();
  for (const e of events) {
    for (const area of e.areas) {
      scores.set(area, (scores.get(area) ?? 0) + e.score);
    }
  }
  const ranked = [...scores.entries()]
    .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))
    .map(([area, score]) => ({ area, score: Number(score.toFixed(3)) }));

  let hot = 0;
  return ranked.map((r, i) => {
    if (i === 0 && r.score >= 3) {
      hot = 1;
      return { ...r, temperature: "hot" as const };
    }
    if (hot && r.score >= ranked[0].score * 0.6) {
      return { ...r, temperature: "hot" as const };
    }
    if (r.score >= 1.5) return { ...r, temperature: "warm" as const };
    return { ...r, temperature: "quiet" as const };
  });
}

/**
 * Event-theme copy (3.1b/3.1c): every string here is tied to a
 * body × aspect family, and every selected item must trace to a real
 * event in provenance.selectedEvents. Original writing for Star Sign;
 * copy.md rules apply: verb-first imperatives, no certainty inflation,
 * retrogrades are weather not threats.
 */

/** Do-items keyed by transiting planet (the active theme). */
const DOS_BY_TRANSIT_PLANET: Record<Planet, string[]> = {
  sun: ["Put your name on the thing you did.", "Spend an hour on what you want, not what's urgent."],
  moon: ["Eat something warm, slowly.", "Say the feeling instead of managing it."],
  mercury: ["Re-read before you hit send.", "Ask the question you've been circling."],
  venus: ["Say the warm thing out loud.", "Plan one small ritual together."],
  mars: ["Start with the hardest task.", "Move your body before you negotiate."],
  jupiter: ["Take the meeting. Offer the idea.", "Learn the thing you keep pretending to know."],
  saturn: ["Ship the smallest useful version.", "Fix the foundation before painting the wall."],
  uranus: ["Change one routine, on purpose.", "Try the unfamiliar route home."],
  neptune: ["Make space for ten quiet minutes.", "Note the dream before coffee."],
  pluto: ["Declutter one hidden corner.", "Tell the truth you've been editing."],
};

/** Don't-items keyed by aspect family (the friction shape). */
const DONTS_BY_ASPECT: Record<Aspect["type"], string[]> = {
  conjunction: ["Don't pile one more thing onto a full day."],
  opposition: ["Don't treat the other side as the enemy.", "Don't answer for someone else's feelings."],
  square: ["Don't force a door that pushes back.", "Don't mistake friction for failure."],
  trine: ["Don't coast past a good window.", "Don't assume easy means done."],
  sextile: ["Don't wait for a better invitation."],
};

/** Extra don'ts keyed by retrograde transits (weather, not threats). */
const DONT_RETROGRADE: Record<Planet, string[]> = {
  sun: [], moon: [], // never retrograde
  mercury: ["Don't sign what you haven't read twice."],
  venus: ["Don't revive an old flirtation by reflex."],
  mars: ["Don't rush the argument you'd redo."],
  jupiter: ["Don't promise more than tonight-you can deliver."],
  saturn: ["Don't skip the boring maintenance."],
  uranus: ["Don't scrap a working plan on a whim."],
  neptune: ["Don't commit to numbers you haven't checked."],
  pluto: ["Don't dig up a settled grave."],
};

export function dosForEvents(events: TransitEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    const opts = DOS_BY_TRANSIT_PLANET[e.transit];
    if (opts?.length) out.push(opts[e.type.length % opts.length]);
  }
  return [...new Set(out)];
}

export function dontsForEvents(events: TransitEvent[]): string[] {
  const out: string[] = [];
  for (const e of events) {
    // Retrograde sharpens the guidance: the planet-specific retro dont
    // leads; the aspect-family dont backs it up.
    const pool = e.retrograde && DONT_RETROGRADE[e.transit].length
      ? [...DONT_RETROGRADE[e.transit], ...DONTS_BY_ASPECT[e.type]]
      : DONTS_BY_ASPECT[e.type];
    if (pool.length) out.push(pool[e.orb * 10 % pool.length | 0]);
  }
  return [...new Set(out)];
}

/**
 * Themed explanation line for an event (3.1c). One line per aspect
 * family × activation shape, written warm and plain per copy.md.
 */
export function explanationForEvent(e: TransitEvent): string {
  const P: Record<Planet, string> = {
    sun: "the Sun", moon: "the Moon", mercury: "Mercury", venus: "Venus",
    mars: "Mars", jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus",
    neptune: "Neptune", pluto: "Pluto",
  };
  const tr = e.retrograde ? " retrograde" : "";
  const shape: Record<Aspect["type"], string> = {
    conjunction: `meets your natal ${cap(e.natal)}`,
    opposition: `pulls against your natal ${cap(e.natal)}`,
    square: `rubs your natal ${cap(e.natal)} the wrong way`,
    trine: `flows with your natal ${cap(e.natal)}`,
    sextile: `opens a small door with your natal ${cap(e.natal)}`,
  };
  const gloss: Record<Aspect["type"], string> = {
    conjunction: "Whatever that part of life holds, it speaks up today.",
    opposition: "Two needs want different things; name yours first.",
    square: "The friction points at what's ready to change.",
    trine: "Use the easy current; it won't announce itself.",
    sextile: "A small opening — walk through it while it's open.",
  };
  return `${cap(P[e.transit])}${tr} ${shape[e.type]}. ${gloss[e.type]}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
