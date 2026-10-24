/**
 * Ephemeris adapter (ASH-236 / 1.1a).
 *
 * Thin boundary over astronomy-engine: the only module in core that knows
 * the library exists. Exposes geocentric apparent ecliptic longitudes and
 * retrograde flags per body per instant. Edge-compatible: astronomy-engine
 * is pure JS, no Node built-ins.
 *
 * Astrology uses *tropical* longitudes of date; Ecliptic() returns true
 * ecliptic of date, which is the correct frame for sign placement.
 */
import * as astro from "astronomy-engine";
import type { Planet } from "./types";

const BODY_BY_PLANET: Record<Exclude<Planet, "sun" | "moon"> | "sun" | "moon", astro.Body> = {
  sun: astro.Body.Sun,
  moon: astro.Body.Moon,
  mercury: astro.Body.Mercury,
  venus: astro.Body.Venus,
  mars: astro.Body.Mars,
  jupiter: astro.Body.Jupiter,
  saturn: astro.Body.Saturn,
  uranus: astro.Body.Uranus,
  neptune: astro.Body.Neptune,
  pluto: astro.Body.Pluto,
};

const DAY_MS = 86400000;

function normalize(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Geocentric apparent ecliptic longitude of date, in degrees [0, 360). */
function eclipticLongitude(body: astro.Body, date: Date): number {
  if (body === astro.Body.Moon) {
    return normalize(astro.EclipticGeoMoon(date).lon);
  }
  // aberration included: apparent position, matching astrological practice
  const vec = astro.GeoVector(body, date, true);
  return normalize(astro.Ecliptic(vec).elon);
}

/**
 * Ecliptic longitude and retrograde flag for a body at a given instant.
 * Retrograde: ecliptic longitude of date decreases over ±1 day (finite
 * difference, wrapping-aware). The Sun and Moon are never retrograde.
 */
export function planetLongitude(
  planet: Planet,
  date: Date,
): { longitude: number; retrograde: boolean } {
  const body = BODY_BY_PLANET[planet];
  if (!body) throw new Error(`no ephemeris body for planet ${planet}`);

  const longitude = eclipticLongitude(body, date);

  let retrograde = false;
  if (body !== astro.Body.Sun && body !== astro.Body.Moon) {
    const fwd = eclipticLongitude(body, new Date(date.getTime() + DAY_MS));
    const bwd = eclipticLongitude(body, new Date(date.getTime() - DAY_MS));
    const motion = ((fwd - bwd + 540) % 360) - 180;
    retrograde = motion < 0;
  }

  return { longitude, retrograde };
}
