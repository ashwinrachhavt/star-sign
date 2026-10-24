import { describe, expect, it } from "vitest";
import { generateCompatibilityReport } from "./compatibility";
import { generateDailyReading } from "./reading";
import type { BirthProfile } from "./types";

const exactProfile: BirthProfile = {
  birthDate: "1990-06-15",
  birthTime: "14:30",
  birthTimePrecision: "exact",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.7128, lon: -74.006 },
};

const approxProfile: BirthProfile = {
  ...exactProfile,
  birthTime: "09:00",
  birthTimePrecision: "approximate",
};

const unknownProfile: BirthProfile = {
  birthDate: "1990-06-15",
  birthTimePrecision: "unknown",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.7128, lon: -74.006 },
};

describe("generateDailyReading", () => {
  const base = { profile: exactProfile, forDate: "2026-10-24" };

  it("is deterministic for the same inputs", () => {
    const a = generateDailyReading(base);
    const b = generateDailyReading(base);
    expect(a).toEqual(b);
  });

  it("changes across dates", () => {
    const a = generateDailyReading(base);
    const b = generateDailyReading({ ...base, forDate: "2026-10-25" });
    expect(a.headline).not.toEqual(b.headline);
  });

  it("includes full provenance", () => {
    const r = generateDailyReading(base);
    expect(r.provenance.rulesetVersion).toBeTruthy();
    expect(r.provenance.copyVersion).toBeTruthy();
    expect(r.provenance.inputs.length).toBeGreaterThan(0);
    expect(r.provenance.inputs.some((i) => i.kind === "natal_placement")).toBe(true);
  });

  it("has three dos and up to three donts with life areas", () => {
    const r = generateDailyReading(base);
    expect(r.dos).toHaveLength(3);
    expect(r.donts.length).toBeGreaterThanOrEqual(2);
    expect(r.donts.length).toBeLessThanOrEqual(3);
    expect(r.lifeAreas.length).toBeGreaterThan(0);
  });

  it("surfaces uncertainty honestly for approximate and unknown times", () => {
    const approx = generateDailyReading({ ...base, profile: approxProfile });
    expect(approx.uncertaintyNote).toMatch(/approximate/i);

    const unknown = generateDailyReading({ ...base, profile: unknownProfile });
    expect(unknown.uncertaintyNote).toMatch(/no birth time/i);
  });

  it("never includes medical/financial/legal deterministic claims", () => {
    const r = generateDailyReading(base);
    const all = [r.headline, r.explanation, ...r.dos, ...r.donts].join(" ");
    expect(all).not.toMatch(/will (definitely|certainly)/i);
    expect(all).not.toMatch(/guaranteed/i);
  });
});

describe("generateCompatibilityReport", () => {
  const partnerB: BirthProfile = {
    birthDate: "1992-11-03",
    birthTime: "08:15",
    birthTimePrecision: "exact",
    birthTimeZone: "America/Chicago",
    birthPlace: { lat: 41.8781, lon: -87.6298 },
  };

  it("produces all five dimensions with valid tones", () => {
    const report = generateCompatibilityReport({
      a: { userId: "u1", displayName: "A", profile: exactProfile },
      b: { userId: "u2", displayName: "B", profile: partnerB },
    });
    expect(report.dimensions.map((d) => d.area).sort()).toEqual(
      ["attraction", "communication", "emotional", "friction", "longterm"].sort(),
    );
    for (const d of report.dimensions) {
      expect(d.tone).toBeGreaterThanOrEqual(1);
      expect(d.tone).toBeLessThanOrEqual(5);
      expect(d.summary.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic", () => {
    const now = new Date("2026-10-24T12:00:00Z");
    const args = {
      a: { userId: "u1", displayName: "A", profile: exactProfile },
      b: { userId: "u2", displayName: "B", profile: partnerB },
      now,
    };
    expect(generateCompatibilityReport(args)).toEqual(
      generateCompatibilityReport(args),
    );
  });
});
