import { describe, it, expect } from "vitest";
import { planetLongitude } from "./ephemeris.js";
import { signForLongitude } from "./chart.js";
import {
  INSTANTS,
  TOLERANCE,
  HORIZONS_LON,
  HORIZONS_LON_PM1,
} from "./ephemeris-fixtures.js";
import type { Planet, ZodiacSign } from "./types.js";

/**
 * Ephemeris validation suite (ASH-239 / 1.4b).
 *
 * Holds the astronomy-engine adapter against JPL Horizons golden values
 * at declared tolerances — see ephemeris-fixtures.ts for full provenance.
 *
 * This is the accuracy gate for the product's core claim. Any change to
 * the ephemeris dependency (engine upgrade, adapter refactor) reruns it;
 * a regression beyond tolerance fails CI.
 */

const BODIES: Planet[] = [
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
];

/** Shortest angular separation between two longitudes, in degrees. */
function angularSep(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

const SIGNS: readonly ZodiacSign[] = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
];

function signFor(deg: number): ZodiacSign {
  return SIGNS[Math.floor((((deg % 360) + 360) % 360) / 30)];
}

describe("ephemeris validation vs JPL Horizons (ASH-239)", () => {
  // 10 bodies x 7 instants = 70 golden-longitude assertions
  it.each(BODIES.flatMap((planet) =>
    INSTANTS.map((iso, i) => ({ planet, iso, ref: HORIZONS_LON[planet][i], tol: TOLERANCE[planet] })),
  ))(
    "$planet @ $iso within $tol deg of Horizons ObsEcLon",
    ({ planet, iso, ref, tol }) => {
      const { longitude } = planetLongitude(planet, new Date(iso));
      const sep = angularSep(longitude, ref);
      expect(sep).toBeLessThanOrEqual(tol);
    },
  );

  // 7 planets x 7 instants = 49 retrograde-flag assertions against
  // externally derived motion (Horizons values at t-1d and t+1d)
  it.each(BODIES.filter((p) => p !== "sun" && p !== "moon").flatMap((planet) =>
    INSTANTS.map((iso, i) => {
      const [b, , f] = HORIZONS_LON_PM1[planet][i];
      const motion = ((f - b + 540) % 360) - 180;
      return { planet, iso, horizonsRetro: motion < 0 };
    }),
  ))(
    "$planet @ $iso retrograde flag matches Horizons-derived motion ($horizonsRetro)",
    ({ planet, iso, horizonsRetro }) => {
      const { retrograde } = planetLongitude(planet, new Date(iso));
      expect(retrograde).toBe(horizonsRetro);
    },
  );

  // 10 bodies x 7 instants = 70 sign-placement assertions: the engine
  // body must land in the same zodiac sign as the Horizons longitude.
  // Guards against off-by-sign regressions tolerances alone could hide
  // when a body sits near a sign boundary.
  it.each(BODIES.flatMap((planet) =>
    INSTANTS.map((iso, i) => ({ planet, iso, refSign: signFor(HORIZONS_LON[planet][i]) })),
  ))(
    "$planet @ $iso occupies the Horizons-derived sign ($refSign)",
    ({ planet, iso, refSign }) => {
      const { longitude } = planetLongitude(planet, new Date(iso));
      expect(signForLongitude(longitude)).toBe(refSign);
    },
  );

  it("sun and moon are never retrograde at any fixture instant", () => {
    for (const iso of INSTANTS) {
      expect(planetLongitude("sun", new Date(iso)).retrograde).toBe(false);
      expect(planetLongitude("moon", new Date(iso)).retrograde).toBe(false);
    }
  });

  // Drift gate (criterion 3): the same comparison the suite performs,
  // fed a deliberately perturbed longitude, must fail at the declared
  // tolerance. Proves the gate catches drift without needing a real
  // engine regression to be present.
  it("drift gate: perturbed longitude fails the tolerance comparison", () => {
    const ref = HORIZONS_LON.sun[0];
    const perturbed = (ref + TOLERANCE.sun + 0.005) % 360; // 0.015 deg off
    const sep = angularSep(perturbed, ref);
    expect(sep).toBeGreaterThan(TOLERANCE.sun);
    // And the real gate would reject it too:
    expect(() => expect(sep).toBeLessThanOrEqual(TOLERANCE.sun)).toThrow();
  });

  it("fixture integrity: 10 bodies x 7 instants present", () => {
    expect(BODIES.length).toBe(10);
    expect(INSTANTS.length).toBe(7);
    for (const b of BODIES) {
      expect(HORIZONS_LON[b]).toHaveLength(7);
      expect(TOLERANCE[b]).toBeGreaterThan(0);
    }
    for (const p of BODIES.filter((b) => b !== "sun" && b !== "moon")) {
      expect(HORIZONS_LON_PM1[p]).toHaveLength(7);
      for (const triple of HORIZONS_LON_PM1[p]) expect(triple).toHaveLength(3);
    }
  });
});
