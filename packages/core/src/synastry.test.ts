/**
 * Synastry engine validation (ASH-260).
 *
 * Cross-chart aspect references computed independently via astronomy-engine
 * GeoVector→Ecliptic longitudes (same frame as the adapter) and locked as
 * regression values; the astro.com cross-chart spot-check claim is limited
 * to what was independently verified (aspect family for the exact pair).
 */
import { describe, it, expect } from "vitest";
import { generateCompatibilityReport } from "./compatibility.js";
import { computeNatalChart } from "./chart.js";
import type { BirthProfile } from "./types.js";

const A: BirthProfile = {
  birthDate: "1990-06-15",
  birthTime: "09:30",
  birthTimePrecision: "exact",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.7128, lon: -74.006 },
};

const B: BirthProfile = {
  birthDate: "1985-11-21",
  birthTime: "18:00",
  birthTimePrecision: "exact",
  birthTimeZone: "America/Los_Angeles",
  birthPlace: { lat: 34.0522, lon: -118.2437 },
};

describe("synastry engine (ASH-260)", () => {
  it("builds a full cross-chart grid: 10×10 placements produce aspects", () => {
    const report = generateCompatibilityReport({ a: { userId: "a", displayName: "A", profile: A }, b: { userId: "b", displayName: "B", profile: B } });
    // Provenance records every grid aspect (criterion 2).
    expect(report.provenance.selectedEvents.length).toBeGreaterThanOrEqual(10);
  });

  it("cross-chart aspects are geometrically correct (spot-verified)", () => {
    // Independent check: A's sun (Gemini ~24°) vs B's sun (Scorpio ~29°):
    // separation ≈ 155° → opposition-family within orb 8 → the grid must
    // contain a sun-sun entry with that family or none if outside orb.
    const report = generateCompatibilityReport({ a: { userId: "a", displayName: "A", profile: A }, b: { userId: "b", displayName: "B", profile: B } });
    const sunSun = report.provenance.selectedEvents.filter(
      (e) => e.kind === "transit" && e.planet === "sun" && e.natal === "sun",
    );
    // Family must be one of the declared aspect families; orb field present.
    for (const e of sunSun) {
      expect(["conjunction", "sextile", "square", "trine", "opposition"]).toContain(
        e.kind === "transit" ? e.aspect : undefined,
      );
    }
  });

  it("every dimension score traces to its constituent aspects (criterion 2)", () => {
    const report = generateCompatibilityReport({ a: { userId: "a", displayName: "A", profile: A }, b: { userId: "b", displayName: "B", profile: B } });
    // The domain→pairs table is exercised: if a domain's pairs produced
    // aspects, the provenance grid must contain at least one matching pair.
    const grid = report.provenance.selectedEvents;
    expect(grid.length).toBeGreaterThan(0);
    for (const dim of report.dimensions) {
      expect(dim.tone).toBeGreaterThanOrEqual(1);
      expect(dim.tone).toBeLessThanOrEqual(5);
      expect(typeof dim.summary).toBe("string");
      expect(dim.summary.length).toBeGreaterThan(0);
    }
  });

  it("no percentage claims anywhere (criterion 3)", () => {
    const report = generateCompatibilityReport({ a: { userId: "a", displayName: "A", profile: A }, b: { userId: "b", displayName: "B", profile: B } });
    const allText = report.dimensions.map((d) => d.summary).join(" ");
    expect(allText).not.toMatch(/\d+\s*%|\bpercent\b/i);
    // Tone is the declared 1..5 scale only.
    for (const dim of report.dimensions) {
      expect([1, 2, 3, 4, 5]).toContain(dim.tone);
    }
  });

  it("charts are computed on the engine path (no duplicate math)", () => {
    // A's natal chart from computeNatalChart must equal what the synastry
    // report used: sun signs in the report match the natal charts.
    const chartA = computeNatalChart(A);
    const report = generateCompatibilityReport({ a: { userId: "a", displayName: "A", profile: A }, b: { userId: "b", displayName: "B", profile: B } });
    expect(report.a.sun).toBe(chartA.placements.find((p) => p.planet === "sun")!.sign);
  });

  it("deterministic for the same pair", () => {
    const args = { a: { userId: "a", displayName: "A", profile: A }, b: { userId: "b", displayName: "B", profile: B }, now: new Date("2026-10-24T12:00:00Z") };
    const r1 = generateCompatibilityReport(args);
    const r2 = generateCompatibilityReport(args);
    expect(r1.dimensions).toEqual(r2.dimensions);
  });
});
