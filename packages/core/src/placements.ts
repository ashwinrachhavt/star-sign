/**
 * Placement interpretation pack (ASH-267) — the copy behind the "You"
 * chart cards. Clean-room: every line is original writing for Star Sign
 * (copy.md rule 6). Structural pattern follows FR-02: each explanation
 * distinguishes planet meaning, sign expression, and house context.
 *
 * Version discipline (copy.md template hygiene): changing any string
 * here bumps PLACEMENTS_COPY_VERSION.
 */
import type { BirthTimePrecision, NatalChart, Planet, ZodiacSign } from "./types";
import { PLANETS, ZODIAC_SIGNS } from "./types";

export const PLACEMENTS_COPY_VERSION = "2026-10.1";

/**
 * What each body rules — the opening line of every placement card.
 * Ends in a period so the sign sentence follows as its own sentence.
 */
export const PLANET_MEANINGS: Record<Planet, string> = {
  sun: "The Sun is the self at the center — your identity, vitality, and the role you grow into.",
  moon: "The Moon is your inner weather — instincts, moods, and what you need to feel safe.",
  mercury: "Mercury is the mind — how you think, talk, learn, and make yourself understood.",
  venus: "Venus is attraction — how you love, what you find beautiful, and what you value.",
  mars: "Mars is the engine — desire, drive, anger, and how you go after what you want.",
  jupiter: "Jupiter is growth — the luck you make, the faith you keep, and the appetite to become more.",
  saturn: "Saturn is structure — discipline, duty, limits, and the things you build to last.",
  uranus: "Uranus is disruption — the part of you that breaks routine and rewires the plan.",
  neptune: "Neptune is the dissolve — dreams, longing, imagination, and the pull of the invisible.",
  pluto: "Pluto is depth — power, obsession, and the slow work of transformation.",
};

/**
 * How a placement expresses through each sign. Written as a clause that
 * continues "meaning" — grammar holds after any planet.
 */
export const SIGN_EXPRESSIONS: Record<ZodiacSign, string> = {
  aries: "you lead from instinct; first is your favorite position, and patience is the lesson.",
  taurus: "you build slowly and hold on firmly; comfort, loyalty, and the senses ground you.",
  gemini: "you live in the plural — curious, quick, and always mid-conversation with the next idea.",
  cancer: "you lead with care; memory, home, and the people you protect are your compass.",
  leo: "you'd rather shine than hide; warmth, pride, and generosity want an audience.",
  virgo: "you improve what you touch; discernment, craft, and useful work are how you love the world.",
  libra: "you weigh every side; beauty, fairness, and company matter more to you than speed.",
  scorpio: "you feel in extremes and trust slowly; what you love, you love all the way down.",
  sagittarius: "you aim at the horizon; freedom, honesty, and the long view keep you moving.",
  capricorn: "you play the long game; ambition, patience, and earned authority are your backbone.",
  aquarius: "you see the system from outside it; originality, friendship, and ideas ahead of their time.",
  pisces: "you live with a door open to the unseen; empathy, art, and escape are your tide.",
};

/** What each house adds, phrased to follow "meaning". Keys 1–12. */
export const HOUSE_MEANINGS: Record<number, string> = {
  1: "you meet the world head-on — this part of you is visible before you say a word.",
  2: "you root it in what you can hold — resources, worth, and the things that make you feel secure.",
  3: "it lives in your everyday exchanges — siblings, neighbors, messages, and the mind's short trips.",
  4: "it belongs to home — roots, family, and the private ground you stand on.",
  5: "it wants an outlet — romance, play, creation, and the pleasure of making something yours.",
  6: "it works through habit — daily routines, craft, health, and the care you give the ordinary.",
  7: "it shows up in partnership — the mirror of commitment, contracts, and the one across from you.",
  8: "it goes deep — shared resources, intimacy, endings, and what changes you for good.",
  9: "it points outward — travel, study, belief, and the far horizons that reframe you.",
  10: "it climbs in public — vocation, reputation, and the mark you intend to leave.",
  11: "it gathers in company — friendships, causes, and the future you build with others.",
  12: "it hides in the quiet — solitude, dreams, the inner life, and what you keep even from yourself.",
};

const ASCENDANT_INTRO =
  "The ascendant is the version of you that arrives first — the lens a room meets before it meets you. It shifts roughly every two hours, so Star Sign only shows it when your birth time is exact.";

/** How the rising sign colors the first impression. */
export const ASCENDANT_LINES: Record<ZodiacSign, string> = {
  aries: "you arrive direct and unguarded; people read you as momentum.",
  taurus: "you arrive unhurried and steady; people read you as safe ground.",
  gemini: "you arrive talking; people read you as quick and curious.",
  cancer: "you arrive with care; people read you as warm — and guarded until you're not.",
  leo: "you arrive lit; people read you as presence before personality.",
  virgo: "you arrive precise; people read you as put-together and observant.",
  libra: "you arrive agreeable; people read you as charm with a scale behind it.",
  scorpio: "you arrive unreadable; people read you as intense whether you speak or not.",
  sagittarius: "you arrive open; people read you as a friend of the whole room.",
  capricorn: "you arrive composed; people read you as someone already in charge.",
  aquarius: "you arrive sideways; people read you as interesting and slightly elsewhere.",
  pisces: "you arrive soft-edged; people read you as familiar, like a half-remembered song.",
};

const ORDINALS = [
  "", "first", "second", "third", "fourth", "fifth", "sixth",
  "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth",
];

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface PlacementInterpretation {
  planet: Planet | "ascendant";
  /** Card title, e.g. "Sun in Leo" / "Ascendant in Cancer". */
  title: string;
  /** Prose paragraphs in display order. */
  paragraphs: string[];
  /** House number when known (never for the ascendant row). */
  house?: number;
  /** Degrees within the sign, when longitude is known. */
  degree?: number;
  retrograde?: boolean;
  sign: ZodiacSign;
}

function planetSentence(planet: Planet, sign: ZodiacSign): string {
  return `Your ${planet} is in ${cap(sign)}, meaning ${SIGN_EXPRESSIONS[sign]}`;
}

function houseSentence(house: number): string {
  const name = ORDINALS[house] ?? `${house}th`;
  return `It's in your ${name} house, meaning ${HOUSE_MEANINGS[house]}`;
}

/**
 * Builds the interpretation cards for a computed chart, in display
 * order: ascendant (exact time only), then planets in PLANETS order.
 * House context appears only where the chart actually carries a house —
 * approximate/unknown times never get house or ascendant claims (FR-02).
 */
export function interpretPlacements(
  chart: NatalChart,
  precision: BirthTimePrecision,
): PlacementInterpretation[] {
  const cards: PlacementInterpretation[] = [];

  if (chart.ascendant) {
    cards.push({
      planet: "ascendant",
      title: `Ascendant in ${cap(chart.ascendant)}`,
      sign: chart.ascendant,
      house: 1,
      paragraphs: [`${ASCENDANT_INTRO} ${cap(ASCENDANT_LINES[chart.ascendant])}`],
    });
  }

  for (const p of chart.placements) {
    const paragraphs = [
      `${PLANET_MEANINGS[p.planet]} ${planetSentence(p.planet, p.sign)}`,
    ];
    if (p.house !== undefined) paragraphs.push(houseSentence(p.house));
    cards.push({
      planet: p.planet,
      title: `${cap(p.planet)} in ${cap(p.sign)}`,
      sign: p.sign,
      house: p.house,
      degree: Math.round((((p.longitude % 360) + 360) % 360) % 30),
      retrograde: p.retrograde,
      paragraphs,
    });
  }
  return cards;
}

/** Completeness guard: the pack must cover every planet, sign, and house. */
export function placementPackComplete(): boolean {
  return (
    PLANETS.every((p) => PLANET_MEANINGS[p]?.length) &&
    ZODIAC_SIGNS.every((s) => SIGN_EXPRESSIONS[s]?.length && ASCENDANT_LINES[s]?.length) &&
    Array.from({ length: 12 }, (_, i) => i + 1).every((h) => HOUSE_MEANINGS[h]?.length)
  );
}
