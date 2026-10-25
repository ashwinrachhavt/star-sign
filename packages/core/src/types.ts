export type BirthTimePrecision = "exact" | "approximate" | "unknown";

export interface BirthProfile {
  /** ISO 8601 date, e.g. "1990-06-15" */
  birthDate: string;
  /** Local clock time "HH:mm", omitted when precision is unknown */
  birthTime?: string;
  birthTimePrecision: BirthTimePrecision;
  /** IANA time zone at birth place, e.g. "America/New_York" */
  birthTimeZone: string;
  birthPlace: { lat: number; lon: number; label?: string };
}

export type ZodiacSign =
  | "aries" | "taurus" | "gemini" | "cancer" | "leo" | "virgo"
  | "libra" | "scorpio" | "sagittarius" | "capricorn" | "aquarius" | "pisces";

export type Planet =
  | "sun" | "moon" | "mercury" | "venus" | "mars"
  | "jupiter" | "saturn" | "uranus" | "neptune" | "pluto";

export const ZODIAC_SIGNS: readonly ZodiacSign[] = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const;

export const PLANETS: readonly Planet[] = [
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
] as const;

export type LifeArea =
  | "love" | "work" | "money" | "home" | "family" | "friends" | "self";

export interface ChartPlacement {
  planet: Planet;
  sign: ZodiacSign;
  /** Ecliptic longitude in degrees [0, 360) */
  longitude: number;
  /** Only meaningful when birthTimePrecision === "exact" */
  house?: number;
  retrograde: boolean;
}

export interface Aspect {
  a: Planet;
  b: Planet;
  type: "conjunction" | "sextile" | "square" | "trine" | "opposition";
  /** Orb in degrees */
  orb: number;
}

export interface NatalChart {
  placements: ChartPlacement[];
  aspects: Aspect[];
  /** Ascendant sign; only present for exact birth time */
  ascendant?: ZodiacSign;
  /**
   * The 12 Porphyry cusp longitudes (degrees [0,360), cusp 1 = asc, 10 =
   * mc) plus the system name for provenance; only present for exact birth
   * time. Houses are never guessed for approximate/unknown times.
   */
  houses?: { system: "porphyry"; cusps: number[] };
}

export interface TransitObservation {
  planet: Planet;
  sign: ZodiacSign;
  retrograde: boolean;
  /** Aspects formed against a natal placement today */
  natalAspects: Array<{ natal: Planet; type: Aspect["type"]; orb: number }>;
}

export type ReadingProvenanceInput =
  | { kind: "natal_placement"; planet: Planet; sign: ZodiacSign }
  | {
      kind: "transit";
      planet: Planet;
      sign: ZodiacSign;
      natal: Planet;
      /** Aspect family of the event; present from ruleset 2026-10.2 (ASH-246). */
      aspect?: Aspect["type"];
      /** Orb in degrees at generation time; present from 2026-10.2 (ASH-251 follow-up). */
      orb?: number;
    }
  | { kind: "lunar_phase"; phase: string };

export interface ReadingProvenance {
  /** Version of the deterministic generation rules used */
  rulesetVersion: string;
  /** Version of the interpretation copy pack used */
  copyVersion: string;
  /** Name and version of the ephemeris library that produced the positions */
  ephemerisName: string;
  ephemerisVersion: string;
  /** Structured record of the transit events the ruleset selected */
  selectedEvents: ReadingProvenanceInput[];
  calculatedAt: string;
  inputs: ReadingProvenanceInput[];
}

/** Ephemeris identity for provenance display (ProvenanceBlock, EPIC 2). */
export interface EphemerisInfo {
  name: string;
  version: string;
}

/** Builds the display-facing ephemeris info from a provenance record. */
export function ephemerisInfoOf(provenance: ReadingProvenance): EphemerisInfo {
  return { name: provenance.ephemerisName, version: provenance.ephemerisVersion };
}

export interface DailyReading {
  id: string;
  /** Local calendar date (user's zone) this reading belongs to */
  forDate: string;
  headline: string;
  explanation: string;
  dos: string[];
  donts: string[];
  lifeAreas: Array<{ area: LifeArea; temperature: "hot" | "warm" | "quiet" }>;
  provenance: ReadingProvenance;
  /** Tied to birth-data precision; surfaced verbatim in the UI */
  uncertaintyNote: string;
  /**
   * Dive deeper v1 (ASH-249): per-event decode lines + a reflective
   * lessons section. Present only when the provenance carries the events
   * that produced the reading — never rendered without full provenance.
   */
  diveDeeper?: DiveDeeper;
}

export interface DiveDeeper {
  /** One decode line per selected event, in provenance order. */
  decoded: Array<{
    event: ReadingProvenanceInput;
    /** Plain-language explanation tracing to the event above. */
    explanation: string;
    /** The event's live geometry, stated plainly. */
    geometry: string;
  }>;
  /** Reflective longer-form lessons of the day (copy.md dive register). */
  lessons: string;
  /**
   * "For you today" (ASH-264): theme-matched curated recs. Each rec
   * carries the event that matched it; empty/absent when nothing matches
   * — never filler.
   */
  recommendations?: Array<{
    kind: "read" | "watch" | "listen";
    title: string;
    creator: string;
    blurb: string;
    url: string;
    /** The transit event that matched this rec's theme. */
    matchedEvent: ReadingProvenanceInput;
  }>;
}

export interface CompatibilityReport {
  a: { userId: string; displayName: string; sun: ZodiacSign; moon?: ZodiacSign };
  b: { userId: string; displayName: string; sun: ZodiacSign; moon?: ZodiacSign };
  dimensions: Array<{
    area: "communication" | "emotional" | "attraction" | "friction" | "longterm";
    summary: string;
    /** 1..5, derived from aspect weights — never presented as objective fact */
    tone: 1 | 2 | 3 | 4 | 5;
  }>;
  provenance: ReadingProvenance;
}
