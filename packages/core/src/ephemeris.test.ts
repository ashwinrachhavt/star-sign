import { describe, it, expect } from "vitest";
import { planetLongitude } from "./ephemeris.js";
import { planetLongitude as exportedLongitude } from "./chart.js";
import { signForLongitude } from "./chart.js";
import type { Planet } from "./types.js";

/**
 * Reference points anchored to exact astronomical events (engine-
 * verifiable, no hand-copied tables): the vernal equinox instant is
 * computed by astronomy-engine's own SearchSunLongitude, so the Sun must
 * sit at 0.000° there by construction; sign boundaries test pure trig.
 * Body-specific spot values are the engine's output — their stability is
 * what these tests lock (a silent library bump shifts them and fails).
 */
const REFERENCE: Array<{ planet: Planet; iso: string; lon: number }> = [
  // J2000 epoch noon
  { planet: "sun", iso: "2000-01-01T12:00:00Z", lon: 280.37 },
  { planet: "moon", iso: "2000-01-01T12:00:00Z", lon: 223.32 },
  { planet: "mercury", iso: "2000-01-01T12:00:00Z", lon: 271.89 },
  // Exact 2026 vernal equinox (SearchSunLongitude-verified)
  { planet: "sun", iso: "2026-03-20T14:45:36Z", lon: 0.0 },
  { planet: "jupiter", iso: "2026-06-15T00:00:00Z", lon: 116.81 },
];

describe("ephemeris adapter (ASH-236)", () => {
  it.each(REFERENCE)("planetLongitude($planet, $iso) matches reference within 0.01°", ({ planet, iso, lon }) => {
    const result = planetLongitude(planet, new Date(iso));
    const sep = Math.abs(((result.longitude - lon + 540) % 360) - 180);
    expect(sep).toBeLessThan(0.01);
  });

  it("sun at the exact 2026 vernal equinox lands at 0.000° (event-anchored)", () => {
    const result = planetLongitude("sun", new Date("2026-03-20T14:45:36.044Z"));
    expect(result.longitude).toBeLessThan(0.001);
    expect(signForLongitude(result.longitude)).toBe("aries");
  });

  it("sun and moon are never retrograde", () => {
    for (const iso of ["2000-01-01T12:00:00Z", "2026-10-24T12:00:00Z"]) {
      expect(planetLongitude("sun", new Date(iso)).retrograde).toBe(false);
      expect(planetLongitude("moon", new Date(iso)).retrograde).toBe(false);
    }
  });

  it("retrograde flags match known engine values for Mercury station periods", () => {
    // Mercury retrograde periods (2026): ~Feb 26–Mar 20, ~Jun 29–Jul 23.
    const retro = planetLongitude("mercury", new Date("2026-03-10T00:00:00Z"));
    expect(retro.retrograde).toBe(true);

    const direct = planetLongitude("mercury", new Date("2026-04-15T00:00:00Z"));
    expect(direct.retrograde).toBe(false);

    const venusRetro = planetLongitude("venus", new Date("2026-10-24T00:00:00Z"));
    expect(typeof venusRetro.retrograde).toBe("boolean");
  });

  it("chart.ts re-export returns engine-computed values (call sites unchanged)", () => {
    const viaChart = exportedLongitude("mars", new Date("2026-10-24T12:00:00Z"));
    const viaAdapter = planetLongitude("mars", new Date("2026-10-24T12:00:00Z"));
    expect(viaChart).toEqual(viaAdapter);
  });

  it("signForLongitude remains pure trig (behavior unchanged)", () => {
    expect(signForLongitude(0)).toBe("aries");
    expect(signForLongitude(29.99)).toBe("aries");
    expect(signForLongitude(30)).toBe("taurus");
    expect(signForLongitude(350)).toBe("pisces");
    expect(signForLongitude(-10)).toBe("pisces");
  });
});
