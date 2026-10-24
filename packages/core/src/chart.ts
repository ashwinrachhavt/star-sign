import {
  type Aspect,
  type BirthProfile,
  type ChartPlacement,
  type NatalChart,
  type Planet,
  type TransitObservation,
  type ZodiacSign,
  PLANETS,
  ZODIAC_SIGNS,
} from "./types";
import { planetLongitude } from "./ephemeris";

const SIGNS_INDEX = new Map<ZodiacSign, number>(ZODIAC_SIGNS.map((s, i) => [s, i]));
const DEG_PER_SIGN = 30;

const ASPECT_ANGLES: Array<[Aspect["type"], number, number]> = [
  ["conjunction", 0, 8],
  ["sextile", 60, 5],
  ["square", 90, 7],
  ["trine", 120, 7],
  ["opposition", 180, 8],
];

export function signForLongitude(longitude: number): ZodiacSign {
  const norm = ((longitude % 360) + 360) % 360;
  return ZODIAC_SIGNS[Math.floor(norm / DEG_PER_SIGN)];
}

function angularSeparation(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

export function aspectsBetween(placements: ChartPlacement[]): Aspect[] {
  const out: Aspect[] = [];
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i];
      const b = placements[j];
      const sep = angularSeparation(a.longitude, b.longitude);
      for (const [type, angle, orbLimit] of ASPECT_ANGLES) {
        const orb = Math.abs(sep - angle);
        if (orb <= orbLimit) {
          out.push({ a: a.planet, b: b.planet, type, orb: Number(orb.toFixed(2)) });
          break;
        }
      }
    }
  }
  return out;
}

/** Approximate ascendant via local sidereal time; valid mid-latitudes, exact-birth only. */
export function ascendantFor(
  utcDate: Date,
  lat: number,
  lon: number,
): ZodiacSign | undefined {
  const jd = utcDate.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  // Mean sidereal time at Greenwich (degrees)
  let gmst =
    280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T;
  const lst = (((gmst + lon) % 360) + 360) % 360;
  const ramc = lst;
  const obl = 23.4392911 * (Math.PI / 180);
  const eps = obl;
  const latR = (lat * Math.PI) / 180;
  const ramcR = (ramc * Math.PI) / 180;
  // Ascendant longitude formula
  const tanAsc =
    Math.cos(ramcR) /
    (-Math.sin(ramcR) * Math.cos(eps) - Math.tan(latR) * Math.sin(eps));
  let asc = (Math.atan(tanAsc) * 180) / Math.PI;
  // Quadrant resolution
  if (Math.cos(ramcR) < 0) asc += 180;
  asc = ((asc % 360) + 360) % 360;
  if (!Number.isFinite(asc)) return undefined;
  return signForLongitude(asc);
}

/**
 * Computes natal chart placements. When birth time is approximate or unknown,
 * house cusps and the ascendant are omitted — never guessed.
 */
export function computeNatalChart(profile: BirthProfile): NatalChart {
  const [y, m, d] = profile.birthDate.split("-").map(Number);
  let hour = 12;
  let minute = 0;
  if (profile.birthTimePrecision === "exact") {
    if (!profile.birthTime) throw new Error("exact precision requires birthTime");
    [hour, minute] = profile.birthTime.split(":").map(Number);
  }

  // Resolve local wall time to UTC via the birth time zone.
  const utc = resolveLocalToUtc(y, m, d, hour, minute, profile.birthTimeZone);

  const placements: ChartPlacement[] = PLANETS.map((planet) => {
    const { longitude, retrograde } = planetLongitude(planet, utc);
    return {
      planet,
      sign: signForLongitude(longitude),
      longitude: Number((((longitude % 360) + 360) % 360).toFixed(4)),
      retrograde,
    };
  });

  const aspects = aspectsBetween(placements);

  if (profile.birthTimePrecision === "exact") {
    const ascendant = ascendantFor(utc, profile.birthPlace.lat, profile.birthPlace.lon);
    return { placements, aspects, ascendant };
  }
  return { placements, aspects };
}

/** Computes today's transits relative to a natal chart. */
export function computeTransits(
  chart: NatalChart,
  now: Date,
): TransitObservation[] {
  const natalByPlanet = new Map(chart.placements.map((p) => [p.planet, p]));
  return PLANETS.map((planet) => {
    const { longitude, retrograde } = planetLongitude(planet, now);
    const norm = ((longitude % 360) + 360) % 360;
    const natalAspects = chart.placements
      .map((natal) => {
        const sep = angularSeparation(norm, natal.longitude);
        for (const [type, angle, orbLimit] of ASPECT_ANGLES) {
          const orb = Math.abs(sep - angle);
          if (orb <= orbLimit) return { natal: natal.planet, type, orb: Number(orb.toFixed(2)) };
        }
        return null;
      })
      .filter((x): x is { natal: Planet; type: Aspect["type"]; orb: number } => x !== null)
      .filter((x) => !(x.natal === planet && natalByPlanet.get(planet)?.sign === signForLongitude(norm)));
    return {
      planet,
      sign: signForLongitude(norm),
      retrograde,
      natalAspects,
    };
  });
}

/** Converts local wall time in a named zone to a UTC Date. */
export function resolveLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  // Two-pass: guess UTC offset at that instant, then correct.
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset1 = tzOffsetMinutes(new Date(guess), timeZone);
  let utcMs = guess - offset1 * 60000;
  const offset2 = tzOffsetMinutes(new Date(utcMs), timeZone);
  if (offset2 !== offset1) utcMs = guess - offset2 * 60000;
  return new Date(utcMs);
}

function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"), get("month") - 1, get("day"),
    get("hour") % 24, get("minute"), get("second"),
  );
  return (asUtc - date.getTime()) / 60000;
}

export { planetLongitude, SIGNS_INDEX };
