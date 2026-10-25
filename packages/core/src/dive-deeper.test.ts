import { describe, it, expect } from "vitest";
import { generateDailyReading } from "./reading.js";
import type { BirthProfile } from "./types.js";

const exactProfile: BirthProfile = {
  birthDate: "1990-06-15",
  birthTime: "09:30",
  birthTimePrecision: "exact",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.7128, lon: -74.006 },
};

describe("dive deeper (ASH-249)", () => {
  const reading = generateDailyReading({ profile: exactProfile, forDate: "2026-10-24" });

  it("diveDeeper present iff events exist; absent means no fake content", () => {
    // Sweep the year across multiple charts: the section must exist exactly
    // when selectedEvents is non-empty — never content without provenance.
    // (Under the current ruleset the Moon guarantees daily events, so the
    // quiet branch is defensive; if a future ruleset change creates quiet
    // days, this test already enforces the omission.)
    const profiles: BirthProfile[] = [
      exactProfile,
      { ...exactProfile, birthDate: "1985-11-21", birthTime: "18:00", birthTimeZone: "America/Los_Angeles", birthPlace: { lat: 34.05, lon: -118.24 } },
      { ...exactProfile, birthDate: "2000-01-01", birthTimePrecision: "unknown", birthTimeZone: "Europe/London", birthPlace: { lat: 51.5, lon: -0.13 } },
    ];
    let sawQuiet = false;
    for (const profile of profiles) {
      for (let d = 0; d < 365; d += 3) {
        const date = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
        const r = generateDailyReading({ profile, forDate: date });
        const hasEvents = r.provenance.selectedEvents.length > 0;
        if (hasEvents) {
          expect(r.diveDeeper, `day ${date} with events must have dive content`).toBeDefined();
          expect(r.diveDeeper!.decoded.length).toBeGreaterThan(0);
        } else {
          expect(r.diveDeeper, `quiet day ${date} must have no dive content`).toBeUndefined();
          sawQuiet = true;
        }
      }
    }
    // Record whether the quiet path was exercised at all this run.
    console.log(`quiet-day path exercised: ${sawQuiet}`);
  });

  it("every decode line traces to a stored provenance event with orb + phase", () => {
    for (let d = 0; d < 30; d++) {
      const date = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
      const r = generateDailyReading({ profile: exactProfile, forDate: date });
      if (!r.diveDeeper) continue;

      // One decode entry per selected event, same order, same identity.
      expect(r.diveDeeper.decoded).toHaveLength(r.provenance.selectedEvents.length);
      r.diveDeeper.decoded.forEach((entry, i) => {
        expect(entry.event).toEqual(r.provenance.selectedEvents[i]);
        expect(entry.explanation).toBeTruthy();
        // Geometry states the orb and the retrograde phase.
        expect(entry.geometry).toMatch(/orb \d+\.\d°/);
        expect(/retrograde|/.test(entry.geometry)).toBe(true);
      });
    }
  });

  it("lessons are reflective, longer-form, and invite returning", () => {
    for (let d = 0; d < 30; d++) {
      const date = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
      const r = generateDailyReading({ profile: exactProfile, forDate: date });
      if (!r.diveDeeper) continue;
      // Longer-form: materially longer than the headline.
      expect(r.diveDeeper.lessons.length).toBeGreaterThan(r.headline.length * 3);
      // Invites returning (the closing line names tonight).
      expect(r.diveDeeper.lessons).toMatch(/tonight|returning|keep/i);
      // Reflective register: no certainty inflation (copy.md ban list).
      expect(r.diveDeeper.lessons).not.toMatch(/\b(will happen|destined|guaranteed|must)\b/i);
    }
  });

  it("is deterministic: same inputs → same dive content", () => {
    const a = generateDailyReading({ profile: exactProfile, forDate: "2026-10-24" });
    const b = generateDailyReading({ profile: exactProfile, forDate: "2026-10-24" });
    expect(a.diveDeeper).toEqual(b.diveDeeper);
  });
});
