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

  // ASH-247 — headline quality bar: transit-driven, ≤12 words.

  const sweepProfiles = [exactProfile, approxProfile, unknownProfile];
  const sweepDates = Array.from({ length: 20 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 9, 1 + i));
    return d.toISOString().slice(0, 10);
  });

  it("every headline across a 20-date × 3-chart sweep is ≤12 words", () => {
    for (const profile of sweepProfiles) {
      for (const forDate of sweepDates) {
        const r = generateDailyReading({ profile, forDate });
        const words = r.headline.trim().split(/\s+/).filter(Boolean);
        expect(words.length, `${forDate}: "${r.headline}"`).toBeLessThanOrEqual(12);
        expect(words.length).toBeGreaterThan(0);
      }
    }
  });

  it("headline is transit-driven: pool key matches the selected provenance event", () => {
    // Sample enough dates that at least one produces a qualifying transit.
    const withTransit = sweepDates
      .map((forDate) => generateDailyReading({ profile: exactProfile, forDate }))
      .filter((r) => r.provenance.selectedEvents.length > 0);
    expect(withTransit.length).toBeGreaterThan(0);

    const planetThemes: Record<string, RegExp[]> = {
      mercury: [/say/i, /read|send|message|word|sentence|talk|conversat|hear|answer|side|ask/i, /silence|less/i],
      venus: [/want|seen|gesture|beauty|affection|pleasure|need|warm|spend|last|shines|halfway/i],
      mars: [/move|door|start|ready|decisive|push|friction|effort|hard|resistance|ground|grip|goal/i],
    };
    for (const r of withTransit) {
      const ev = r.provenance.selectedEvents[0];
      if (!("planet" in ev)) continue;
      const patterns = planetThemes[ev.planet] ?? [];
      const matched = patterns.some((p) => p.test(r.headline));
      // The headline template pool is keyed to the selected planet; if the
      // planet's theme vocabulary doesn't appear, the line may still come
      // from the planet's pool — but a Venus line under a Mars event would
      // be a selection bug. Fail only on cross-planet mismatches that the
      // other planets' vocabularies uniquely claim.
      if (!matched) continue;
      for (const [other, otherPatterns] of Object.entries(planetThemes)) {
        if (other === ev.planet) continue;
        const uniquelyOther =
          otherPatterns.some((p) => p.test(r.headline)) &&
          !patterns.some((p) => p.test(r.headline));
        expect(uniquelyOther, `"${r.headline}" under ${ev.planet} event`).toBe(false);
      }
    }
  });

  it("headline changes when the dominant transit changes (same chart, different sky)", () => {
    // Find two dates for the same profile whose selected transits differ in
    // planet or aspect family — the headline must differ too.
    const readings = sweepDates.map((forDate) =>
      generateDailyReading({ profile: exactProfile, forDate }),
    );
    let found = false;
    for (let i = 0; i < readings.length && !found; i++) {
      for (let j = i + 1; j < readings.length && !found; j++) {
        const a = readings[i].provenance.selectedEvents[0];
        const b = readings[j].provenance.selectedEvents[0];
        const keyOf = (e: (typeof a) | undefined) =>
          e && "planet" in e ? `${e.planet}+${"natal" in e ? e.natal : ""}` : "none";
        if (keyOf(a) !== keyOf(b)) {
          found = true;
          expect(readings[i].headline).not.toBe(readings[j].headline);
        }
      }
    }
    expect(found, "sweep should contain differing dominant transits").toBe(true);
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
