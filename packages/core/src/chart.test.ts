import { describe, expect, it } from "vitest";
import {
  ascendantFor,
  aspectsBetween,
  computeNatalChart,
  computeTransits,
  planetLongitude,
  resolveLocalToUtc,
  signForLongitude,
} from "./chart";
import type { ChartPlacement } from "./types";
import type { BirthProfile } from "./types";

const exactProfile: BirthProfile = {
  birthDate: "1990-06-15",
  birthTime: "14:30",
  birthTimePrecision: "exact",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.7128, lon: -74.006 },
};

const unknownTimeProfile: BirthProfile = {
  birthDate: "1990-06-15",
  birthTimePrecision: "unknown",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.7128, lon: -74.006 },
};

describe("signForLongitude", () => {
  it("maps 0-30 to aries and wraps", () => {
    expect(signForLongitude(0)).toBe("aries");
    expect(signForLongitude(29.9)).toBe("aries");
    expect(signForLongitude(30)).toBe("taurus");
    expect(signForLongitude(359)).toBe("pisces");
    expect(signForLongitude(-10)).toBe("pisces");
  });
});

describe("resolveLocalToUtc", () => {
  it("respects standard time offset", () => {
    const utc = resolveLocalToUtc(1990, 6, 15, 14, 30, "America/New_York");
    // June = EDT (UTC-4)
    expect(utc.toISOString()).toBe("1990-06-15T18:30:00.000Z");
  });

  it("respects daylight saving boundaries", () => {
    const winter = resolveLocalToUtc(1990, 1, 15, 12, 0, "America/New_York");
    expect(winter.toISOString()).toBe("1990-01-15T17:00:00.000Z");
  });
});

describe("planetLongitude", () => {
  it("places the sun within the expected sign band for late June", () => {
    // Sun around June 15 should be in gemini (tropical zodiac, ~24° gemini)
    const { longitude } = planetLongitude("sun", new Date("1990-06-15T18:30:00Z"));
    expect(signForLongitude(longitude)).toBe("gemini");
    expect(longitude).toBeGreaterThan(80);
    expect(longitude).toBeLessThan(90);
  });

  it("returns finite longitudes for all planets", () => {
    const date = new Date("2026-10-24T12:00:00Z");
    for (const p of ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"] as const) {
      const { longitude } = planetLongitude(p, date);
      expect(Number.isFinite(longitude)).toBe(true);
      expect(longitude).toBeGreaterThanOrEqual(0);
      expect(longitude).toBeLessThan(360);
    }
  });

  it("moon advances ~13 degrees per day", () => {
    const t0 = new Date("2026-10-01T00:00:00Z");
    const a = planetLongitude("moon", t0).longitude;
    const b = planetLongitude("moon", new Date(t0.getTime() + 86400000)).longitude;
    const delta = ((b - a + 360) % 360);
    expect(delta).toBeGreaterThan(11);
    expect(delta).toBeLessThan(16);
  });
});

describe("aspectsBetween", () => {
  const mk = (planet: string, longitude: number): ChartPlacement => ({
    planet: planet as never,
    sign: signForLongitude(longitude),
    longitude,
    retrograde: false,
  });

  it("finds a trine and skips non-aspects", () => {
    const a = aspectsBetween([mk("sun", 0), mk("moon", 120), mk("mars", 95)]);
    expect(a.some((x) => x.type === "trine")).toBe(true);
    expect(a.some((x) => x.type === "square")).toBe(true);
    expect(a).toHaveLength(2);
  });
});

describe("computeNatalChart", () => {
  it("computes placements for exact birth time", () => {
    const chart = computeNatalChart(exactProfile);
    expect(chart.placements).toHaveLength(10);
    expect(chart.ascendant).toBeDefined();
    const sun = chart.placements.find((p) => p.planet === "sun")!;
    expect(sun.sign).toBe("gemini");
  });

  it("never invents houses or ascendant for unknown birth time", () => {
    const chart = computeNatalChart(unknownTimeProfile);
    expect(chart.ascendant).toBeUndefined();
    expect(chart.placements.every((p) => p.house === undefined)).toBe(true);
  });

  it("throws if exact precision has no time", () => {
    expect(() =>
      computeNatalChart({ ...exactProfile, birthTime: undefined }),
    ).toThrow(/birthTime/);
  });
});

describe("computeTransits", () => {
  it("returns ten transiting bodies with natal aspects", () => {
    const chart = computeNatalChart(exactProfile);
    const transits = computeTransits(chart, new Date("2026-10-24T12:00:00Z"));
    expect(transits).toHaveLength(10);
    expect(transits.every((t) => Array.isArray(t.natalAspects))).toBe(true);
  });
});

describe("ascendantFor", () => {
  it("returns a zodiac sign for a daytime chart", () => {
    const utc = resolveLocalToUtc(1990, 6, 15, 14, 30, "America/New_York");
    const asc = ascendantFor(utc, 40.7128, -74.006);
    expect(asc).toBeDefined();
    expect(typeof asc).toBe("string");
  });
});
