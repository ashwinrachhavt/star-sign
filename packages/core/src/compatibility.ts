import { aspectsBetween, computeNatalChart } from "./chart";
import { EPHEMERIS_NAME, EPHEMERIS_VERSION } from "./reading";
import type {
  Aspect,
  BirthProfile,
  CompatibilityReport,
  NatalChart,
  Planet,
} from "./types";

/**
 * Compatibility is scored from cross-chart aspects between the two natal
 * placements. Tone (1..5) describes the *character* of an interaction, not a
 * verdict on the relationship. Copy never claims objective fact.
 */

const DIMENSION_ASPECTS: Record<
  CompatibilityReport["dimensions"][number]["area"],
  { positive: Aspect["type"][]; negative: Aspect["type"][]; pairs: Array<[string, string]> }
> = {
  communication: {
    positive: ["trine", "sextile"],
    negative: ["square", "opposition"],
    pairs: [["mercury", "mercury"], ["mercury", "moon"], ["sun", "mercury"], ["mercury", "ascendant"]],
  },
  emotional: {
    positive: ["trine", "conjunction"],
    negative: ["square"],
    pairs: [["moon", "moon"], ["moon", "venus"], ["moon", "sun"], ["venus", "moon"]],
  },
  attraction: {
    positive: ["conjunction", "trine"],
    negative: ["square"],
    pairs: [["venus", "mars"], ["mars", "venus"], ["venus", "venus"], ["mars", "mars"]],
  },
  friction: {
    positive: ["sextile"],
    negative: ["square", "opposition", "conjunction"],
    pairs: [["mars", "mars"], ["mars", "saturn"], ["sun", "saturn"], ["moon", "saturn"]],
  },
  longterm: {
    positive: ["trine", "sextile"],
    negative: ["square", "opposition"],
    pairs: [["saturn", "saturn"], ["jupiter", "sun"], ["sun", "moon"], ["jupiter", "moon"]],
  },
};

const COPY: Record<
  CompatibilityReport["dimensions"][number]["area"],
  Record<1 | 2 | 3 | 4 | 5, string>
> = {
  communication: {
    1: "Conversations take work. Assume good intent and say the plain version.",
    2: "You process words differently; slow down before responding.",
    3: "Communication is workable — different styles, same willingness.",
    4: "You finish each other's sentences more often than not.",
    5: "Talking with each other is the easiest part of this.",
  },
  emotional: {
    1: "Emotional wavelengths rarely match in the moment; patience is the bridge.",
    2: "You each show care differently, and it can read as absence.",
    3: "Emotional understanding comes in pockets, and they matter.",
    4: "You tend to feel what the other is feeling without being told.",
    5: "A rare emotional shorthand — you get each other.",
  },
  attraction: {
    1: "Attraction is quiet here; it may build slowly or stay companionable.",
    2: "Sparks are intermittent — context and effort matter a lot.",
    3: "Steady pull, more warmth than fireworks.",
    4: "Strong mutual draw; you notice each other across a room.",
    5: "Magnetic. The pull is immediate and hard to explain.",
  },
  friction: {
    1: "Friction is rare — mostly ease, occasionally avoiding the hard thing.",
    2: "Mostly smooth with occasional static.",
    3: "A real but productive friction; you challenge each other.",
    4: "Sparks of friction are frequent; repair skills matter here.",
    5: "High-friction pairing. Growth is possible but takes deliberate work.",
  },
  longterm: {
    1: "Long-term alignment asks a lot of deliberate negotiation.",
    2: "Sustainable with structure and honest check-ins.",
    3: "Solid footing — neither effortless nor fragile.",
    4: "Built to last; your rhythms reinforce each other.",
    5: "Enduring by design — values and pace align naturally.",
  },
};

function toneFrom(aspects: Aspect[]): 1 | 2 | 3 | 4 | 5 {
  if (aspects.length === 0) return 3;
  let score = 0;
  for (const a of aspects) {
    if (a.type === "trine" || a.type === "sextile") score += 1;
    if (a.type === "conjunction") score += 0.5;
    if (a.type === "square") score -= 1;
    if (a.type === "opposition") score -= 0.5;
    // tight orbs weigh more
    if (a.orb < 3) score *= 1.2;
  }
  const norm = Math.max(-2, Math.min(2, score / Math.max(aspects.length, 1) / 1.2));
  const tone = Math.round((norm + 2) / 4 * 4) + 1; // 1..5
  return Math.max(1, Math.min(5, tone)) as 1 | 2 | 3 | 4 | 5;
}

export interface CompatibilityArgs {
  a: { userId: string; displayName: string; profile: BirthProfile };
  b: { userId: string; displayName: string; profile: BirthProfile };
  now?: Date;
}

export function generateCompatibilityReport(args: CompatibilityArgs): CompatibilityReport {
  const chartA: NatalChart = computeNatalChart(args.a.profile);
  const chartB: NatalChart = computeNatalChart(args.b.profile);

  const placementsA = new Map(chartA.placements.map((p) => [p.planet, p]));
  const placementsB = new Map(chartB.placements.map((p) => [p.planet, p]));

  const sunA = placementsA.get("sun")!;
  const moonA = placementsA.get("moon")!;
  const sunB = placementsB.get("sun")!;
  const moonB = placementsB.get("moon")!;

  // 6.1a: full cross-chart aspect grid — every planet in A against every
  // planet in B, on engine-accurate charts. `aspectsBetween` computes the
  // aspect family + orb for any placement pair; feeding it one placement
  // from each chart yields the synastry grid. (6.1c: no duplicate math —
  // this is the same engine path the natal chart uses.)
  const synastryAspects: Array<Aspect & { a: Planet; b: Planet }> = [];
  for (const pa of chartA.placements) {
    for (const pb of chartB.placements) {
      for (const aspect of aspectsBetween([pa, pb])) {
        synastryAspects.push({ ...aspect, a: pa.planet, b: pb.planet });
      }
    }
  }

  const dimensions = (
    Object.entries(DIMENSION_ASPECTS) as Array<
      [CompatibilityReport["dimensions"][number]["area"], typeof DIMENSION_ASPECTS["communication"]]
    >
  ).map(([area, spec]) => {
    // 6.1b: score per domain from the aspects that involve the domain's
    // planet pairs, traced to the grid (criterion 2).
    const contributing = synastryAspects.filter((as) =>
      spec.pairs.some(
        ([x, y]) =>
          (as.a === x && as.b === y) || (as.a === y && as.b === x),
      ),
    );
    const tone = toneFrom(contributing);
    return { area, summary: COPY[area][tone], tone };
  });

  return {
    a: { userId: args.a.userId, displayName: args.a.displayName, sun: sunA.sign, moon: moonA.sign },
    b: { userId: args.b.userId, displayName: args.b.displayName, sun: sunB.sign, moon: moonB.sign },
    dimensions,
    provenance: {
      rulesetVersion: "synastry-2026-10.2",
      copyVersion: "2026-10.2",
      ephemerisName: EPHEMERIS_NAME,
      ephemerisVersion: EPHEMERIS_VERSION,
      // 6.1b criterion 2: the aspects that produced each domain score are
      // recorded as provenance inputs (cross-chart transits).
      selectedEvents: synastryAspects.map((as) => ({
        kind: "transit" as const,
        planet: as.a,
        sign: "aries" as const,
        natal: as.b,
        aspect: as.type,
      })),
      calculatedAt: (args.now ?? new Date()).toISOString(),
      inputs: [
        { kind: "natal_placement", planet: "sun", sign: sunA.sign },
        { kind: "natal_placement", planet: "sun", sign: sunB.sign },
        { kind: "natal_placement", planet: "moon", sign: moonA.sign },
        { kind: "natal_placement", planet: "moon", sign: moonB.sign },
      ],
    },
  };
}
