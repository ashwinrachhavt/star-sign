/**
 * Porphyry house cusps (ASH-237 / 1.2a).
 *
 * Porphyry is a quadrant system: the ascendant is the 1st cusp, the
 * medium coeli (MC) the 10th, and the remaining cusps trisect the two
 * quadrant arcs. Owner-confirmed system (matches the product's declared
 * convention); provenance declares "porphyry".
 */
import type { ZodiacSign } from "./types";
import { signForLongitude } from "./chart";

export interface ChartAngles {
  /** Ascendant ecliptic longitude, degrees [0, 360) */
  asc: number;
  /** Medium coeli ecliptic longitude, degrees [0, 360) */
  mc: number;
}

/**
 * Beyond the arctic/antarctic circles the ascendant is undefined for
 * parts of the day (circumpolar singularity) and quadrant houses lose
 * meaning; Porphyry is not computed there. 66° matches the astrological
 * convention for the meaningful-house band.
 */
export const HOUSE_LATITUDE_LIMIT = 66;

function normalize(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Ecliptic longitudes of the ascendant and MC for an instant and place.
 *
 * MC: apparent ecliptic longitude whose right ascension equals local
 * apparent sidereal time (classic formula tan(λ_MC) = tan(θ)/cos(ε)).
 * Ascendant: from the ascension formula tan(λ_Asc) = −cos(θ) /
 * (sin(θ)·cos(ε) + tan(φ)·sin(ε)), quadrant-corrected to always fall
 * within 180° rising above the horizon.
 */
export function anglesFor(utcDate: Date, lat: number, lon: number): ChartAngles {
  if (Math.abs(lat) >= HOUSE_LATITUDE_LIMIT) {
    throw new Error(
      `latitude ${lat} beyond ±${HOUSE_LATITUDE_LIMIT}°: houses and ascendant are not meaningful (circumpolar singularity)`,
    );
  }
  const jd = utcDate.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;

  // Mean sidereal time at Greenwich (degrees), IAU 1982 (Meeus 12.4)
  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    T * T * T / 38710000;
  const lst = normalize(gmst + lon); // east longitude positive
  const ramc = lst; // RA of meridian

  const eps = (23.4392911 - 0.0130042 * T) * (Math.PI / 180); // mean obliquity of date
  const latR = (lat * Math.PI) / 180;
  const ramcR = (ramc * Math.PI) / 180;

  // MC longitude: tan λ = tan θ / cos ε — atan2 resolves the quadrant so
  // MC shares the meridian's hemisphere (RAMC 0-180 → MC 0-180).
  const mc = normalize(
    (Math.atan2(Math.tan(ramcR), Math.cos(eps)) * 180) / Math.PI,
  );

  // Ascendant: tan(λ) = cos θ / −(sin θ·cos ε + tan φ·sin ε). atan2 gives
  // the correct quadrant directly (the classic `if cos θ < 0 add 180`
  // patch mis-resolves half the wheel).
  const asc = normalize(
    (Math.atan2(
      Math.cos(ramcR),
      -(Math.sin(ramcR) * Math.cos(eps) + Math.tan(latR) * Math.sin(eps)),
    ) *
      180) /
      Math.PI,
  );
  if (!Number.isFinite(asc) || !Number.isFinite(mc)) {
    throw new Error(`no valid ascendant at latitude ${lat}`);
  }

  return { asc, mc };
}

/**
 * The 12 Porphyry cusp longitudes in zodiacal order. Cusp 1 = asc, cusp 10
 * = mc; cusps 11/12 trisect the arc mc→asc; cusps 2/3 trisect asc→ic
 * (ic = mc + 180); cusps 4-9 mirror by opposition (cusp n+6 = cusp n + 180).
 */
export function porphyryCusps(angles: ChartAngles): number[] {
  const { asc, mc } = angles;
  const ic = normalize(mc + 180);

  // Zodiacal forward arc from a to b, in (0, 360]
  const arc = (a: number, b: number) => normalize(b - a) || 360;

  // Quadrant 1: mc → asc (houses 10, 11, 12, then asc starts house 1)
  const arcMcAsc = arc(mc, asc);
  const c11 = normalize(mc + arcMcAsc / 3);
  const c12 = normalize(mc + (2 * arcMcAsc) / 3);

  // Quadrant 2: asc → ic (houses 1, 2, 3, then ic starts house 4)
  const arcAscIc = arc(asc, ic);
  const c2 = normalize(asc + arcAscIc / 3);
  const c3 = normalize(asc + (2 * arcAscIc) / 3);

  // Houses 4-9 are the exact opposites of 10-3 respectively:
  // c4 = ic (opposite mc), c5 = opposite c11, c6 = opposite c12,
  // c7 = opposite asc, c8 = opposite c2, c9 = opposite c3.
  return [
    asc, // 1
    c2,
    c3,
    ic, // 4
    normalize(c11 + 180), // 5
    normalize(c12 + 180), // 6
    normalize(asc + 180), // 7
    normalize(c2 + 180), // 8
    normalize(c3 + 180), // 9
    mc, // 10
    c11,
    c12,
  ];
}

/** 1-based house number containing the given ecliptic longitude. */
export function houseForLongitude(
  longitude: number,
  cusps: number[],
): number {
  const lon = normalize(longitude);
  for (let house = 1; house <= 12; house++) {
    const cusp = normalize(cusps[house - 1]);
    const next = normalize(cusps[house % 12]);
    const into = normalize(lon - cusp);
    const span = normalize(next - cusp) || 360;
    if (into < span) return house;
  }
  // Unreachable: every longitude falls in exactly one cusp interval
  throw new Error(`no house found for longitude ${longitude}`);
}

/** Sign of a cusp (convenience for UI). */
export function cuspSign(longitude: number): ZodiacSign {
  return signForLongitude(longitude);
}
