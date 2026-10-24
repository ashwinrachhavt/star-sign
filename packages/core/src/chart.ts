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

/** Ecliptic longitude and retrograde flag for a planet at a given instant. */
export function planetLongitude(
  planet: Planet,
  date: Date,
): { longitude: number; retrograde: boolean } {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const rad = Math.PI / 180;

  const meanAnomaly = (M0: number, M1: number) => ((M0 + M1 * T) % 360) * rad;

  // VSOP87-truncated elements (Meeus, Astronomical Algorithms): L (mean longitude),
  // a (semi-major axis, AU), e (eccentricity), perihelion argument & mean anomaly.
  const ELEM: Record<string, { L0: number; L1: number; a: number; e: number; varpi: number }> = {
    mercury: { L0: 252.250906, L1: 149472.67411175, a: 0.38709831, e: 0.20563175, varpi: 77.45611923 },
    venus:   { L0: 181.979701, L1: 58517.81560260,  a: 0.72332982, e: 0.00677188, varpi: 131.53298268 },
    earth:   { L0: 100.464571, L1: 35999.37244981,  a: 1.00000102, e: 0.01671123, varpi: 102.93768193 },
    mars:    { L0: 355.433000, L1: 19140.30268499,  a: 1.52371034, e: 0.09339410, varpi: 336.04084040 },
    jupiter: { L0: 34.351519,  L1: 3034.90566060,   a: 5.20288700, e: 0.04838624, varpi: 14.75385060 },
    saturn:  { L0: 50.077436,  L1: 1222.11492992,   a: 9.53667594, e: 0.05386179, varpi: 92.43163489 },
    uranus:  { L0: 314.200570, L1: 428.49512530,    a: 19.18916464, e: 0.04725744, varpi: 170.96424847 },
    neptune: { L0: 304.349477, L1: 218.45971619,    a: 30.06992276, e: 0.00859048, varpi: 44.97135063 },
    pluto:   { L0: 238.929038, L1: 145.20780515,    a: 39.48211675, e: 0.24882730, varpi: 224.06891629 },
  };

  if (planet === "sun") {
    const { L0, L1, a, e, varpi } = ELEM.earth;
    const M = meanAnomaly(L0 - varpi, L1);
    const C = (2 * e - e * e * e / 4) * Math.sin(M) + (5 * e * e / 4) * Math.sin(2 * M) + (13 * e * e * e / 12) * Math.sin(3 * M);
    const trueLon = L0 + L1 * T + C;
    const longitude = trueLon + 180; // geocentric sun = earth heliocentric + 180
    return { longitude: ((longitude % 360) + 360) % 360, retrograde: false };
  }

  if (planet === "moon") {
    // Meeus ch. 47 (truncated): mean longitude + main perturbation terms.
    const Lp = 218.3164477 + 481267.88123421 * T;
    const D = 297.8501921 + 445267.1114034 * T;
    const M = 357.5291092 + 35999.0502909 * T;
    const Mp = 134.9633964 + 477198.8675055 * T;
    const F = 93.2720950 + 483202.0175233 * T;
    const r = (x: number) => x * rad;
    let lon = Lp
      + 6.289 * Math.sin(r(Mp))
      + 1.274 * Math.sin(r(2 * D - Mp))
      + 0.658 * Math.sin(r(2 * D))
      + 0.214 * Math.sin(r(2 * Mp))
      - 0.186 * Math.sin(r(M))
      - 0.114 * Math.sin(r(2 * F));
    // Approximate retrograde: Moon is never retrograde in geocentric ecliptic longitude.
    return { longitude: ((lon % 360) + 360) % 360, retrograde: false };
  }

  const el = ELEM[planet];
  if (!el) throw new Error(`no elements for planet ${planet}`);

  const helio = (elName: string) => {
    const e2 = ELEM[elName];
    const M = meanAnomaly(e2.L0 - e2.varpi, e2.L1);
    const C = (2 * e2.e - e2.e ** 3 / 4) * Math.sin(M) + (5 * e2.e ** 2 / 4) * Math.sin(2 * M) + (13 * e2.e ** 3 / 12) * Math.sin(3 * M);
    const trueLon = e2.L0 + e2.L1 * T + C;
    const v = M + C;
    const r = e2.a * (1 - e2.e * Math.cos(M));
    const w = (e2.varpi * rad);
    const x = r * Math.cos(w + v);
    const y = r * Math.sin(w + v);
    return { x, y };
  };

  const p = helio(planet);
  const earth = helio("earth");
  const dx = p.x - earth.x;
  const dy = p.y - earth.y;
  let geocentric = (Math.atan2(dy, dx) / rad) % 360;
  geocentric = ((geocentric % 360) + 360) % 360;

  // Retrograde via finite difference over ±1 day (computed from elements
  // directly, not via planetLongitude, to avoid recursion)
  const fwd = rawGeocentricLongitude(planet, date.getTime() + 86400000);
  const bwd = rawGeocentricLongitude(planet, date.getTime() - 86400000);
  const motion = ((fwd - bwd + 540) % 360) - 180;

  return { longitude: geocentric, retrograde: motion < 0 };
}

/** Geocentric ecliptic longitude without retrograde computation. */
function rawGeocentricLongitude(planet: Planet, ms: number): number {
  const date = new Date(ms);
  const jd = ms / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const rad = Math.PI / 180;

  const ELEM: Record<string, { L0: number; L1: number; a: number; e: number; varpi: number }> = {
    mercury: { L0: 252.250906, L1: 149472.67411175, a: 0.38709831, e: 0.20563175, varpi: 77.45611923 },
    venus:   { L0: 181.979701, L1: 58517.81560260,  a: 0.72332982, e: 0.00677188, varpi: 131.53298268 },
    earth:   { L0: 100.464571, L1: 35999.37244981,  a: 1.00000102, e: 0.01671123, varpi: 102.93768193 },
    mars:    { L0: 355.433000, L1: 19140.30268499,  a: 1.52371034, e: 0.09339410, varpi: 336.04084040 },
    jupiter: { L0: 34.351519,  L1: 3034.90566060,   a: 5.20288700, e: 0.04838624, varpi: 14.75385060 },
    saturn:  { L0: 50.077436,  L1: 1222.11492992,   a: 9.53667594, e: 0.05386179, varpi: 92.43163489 },
    uranus:  { L0: 314.200570, L1: 428.49512530,    a: 19.18916464, e: 0.04725744, varpi: 170.96424847 },
    neptune: { L0: 304.349477, L1: 218.45971619,    a: 30.06992276, e: 0.00859048, varpi: 44.97135063 },
    pluto:   { L0: 238.929038, L1: 145.20780515,    a: 39.48211675, e: 0.24882730, varpi: 224.06891629 },
  };

  if (planet === "sun") {
    const el = ELEM.earth;
    const M = ((el.L0 - el.varpi + el.L1 * T) % 360) * rad;
    const C = (2 * el.e - el.e ** 3 / 4) * Math.sin(M) + (5 * el.e ** 2 / 4) * Math.sin(2 * M) + (13 * el.e ** 3 / 12) * Math.sin(3 * M);
    const longitude = el.L0 + el.L1 * T + C + 180;
    return ((longitude % 360) + 360) % 360;
  }

  if (planet === "moon") {
    const Lp = 218.3164477 + 481267.88123421 * T;
    const D = 297.8501921 + 445267.1114034 * T;
    const M = 357.5291092 + 35999.0502909 * T;
    const Mp = 134.9633964 + 477198.8675055 * T;
    const F = 93.2720950 + 483202.0175233 * T;
    const r = (x: number) => x * rad;
    const lon = Lp
      + 6.289 * Math.sin(r(Mp))
      + 1.274 * Math.sin(r(2 * D - Mp))
      + 0.658 * Math.sin(r(2 * D))
      + 0.214 * Math.sin(r(2 * Mp))
      - 0.186 * Math.sin(r(M))
      - 0.114 * Math.sin(r(2 * F));
    return ((lon % 360) + 360) % 360;
  }

  const el = ELEM[planet];
  if (!el) throw new Error(`no elements for planet ${planet}`);

  const helio = (elName: string) => {
    const e2 = ELEM[elName];
    const M = ((e2.L0 - e2.varpi + e2.L1 * T) % 360) * rad;
    const C = (2 * e2.e - e2.e ** 3 / 4) * Math.sin(M) + (5 * e2.e ** 2 / 4) * Math.sin(2 * M) + (13 * e2.e ** 3 / 12) * Math.sin(3 * M);
    const v = M + C;
    const r = e2.a * (1 - e2.e * Math.cos(M));
    const w = e2.varpi * rad;
    return { x: r * Math.cos(w + v), y: r * Math.sin(w + v) };
  };

  const p = helio(planet);
  const earth = helio("earth");
  let geocentric = (Math.atan2(p.y - earth.y, p.x - earth.x) / rad) % 360;
  return ((geocentric % 360) + 360) % 360;
}

export { SIGNS_INDEX };
