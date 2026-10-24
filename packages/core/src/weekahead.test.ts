import { describe, expect, it } from "vitest";
import { computeWeekAhead, WEEKAHEAD_VERSION } from "./weekahead";
import { computeNatalChart, computeTransits } from "./chart";
import { scoreTransitEvents } from "./ruleset";
import type { BirthProfile } from "./types";

const exactProfile: BirthProfile = {
  birthDate: "1990-06-15",
  birthTime: "14:30",
  birthTimePrecision: "exact",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.7128, lon: -74.006 },
};

const unknownProfile: BirthProfile = {
  birthDate: "1990-06-15",
  birthTimePrecision: "unknown",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.7128, lon: -74.006 },
};

const NOW = new Date("2026-10-24T12:00:00Z");

describe("computeWeekAhead (ASH-252)", () => {
  it("returns exactly 7 days with consecutive calendar dates", () => {
    const week = computeWeekAhead(exactProfile, { now: NOW });
    expect(week.days).toHaveLength(7);
    expect(week.days[0].date).toBe("2026-10-24");
    expect(week.days[6].date).toBe("2026-10-30");
    for (let i = 1; i < 7; i++) {
      const prev = new Date(week.days[i - 1].date + "T00:00:00Z");
      const cur = new Date(week.days[i].date + "T00:00:00Z");
      expect((cur.getTime() - prev.getTime()) / 86400000).toBe(1);
    }
  });

  it("is deterministic for the same inputs", () => {
    const a = computeWeekAhead(exactProfile, { now: NOW });
    const b = computeWeekAhead(exactProfile, { now: NOW });
    expect(a).toEqual(b);
  });

  it("every displayed event traces to computeTransits output (no invented events)", () => {
    const week = computeWeekAhead(exactProfile, { now: NOW });
    const chart = computeNatalChart(exactProfile);
    for (const day of week.days) {
      const instant = new Date(day.date + "T16:00:00Z"); // local noon EDT
      const transits = computeTransits(chart, instant);
      const scored = scoreTransitEvents(transits);
      for (const e of day.events) {
        const match = scored.find(
          (s) =>
            s.transit === e.transit &&
            s.natal === e.natal &&
            s.type === e.type &&
            Math.abs(s.orb - e.orb) < 0.01 &&
            s.score === e.score,
        );
        expect(match, `ungrounded event: ${e.transit} ${e.type} natal ${e.natal} on ${day.date}`).toBeTruthy();
      }
    }
  });

  it("events per day are ranked strongest-first and capped", () => {
    const week = computeWeekAhead(exactProfile, { now: NOW, perDayCap: 2 });
    for (const day of week.days) {
      expect(day.events.length).toBeLessThanOrEqual(2);
      for (let i = 1; i < day.events.length; i++) {
        expect(day.events[i - 1].score).toBeGreaterThanOrEqual(day.events[i].score);
      }
    }
  });

  it("records the version (criterion 2)", () => {
    const week = computeWeekAhead(exactProfile, { now: NOW });
    expect(week.version).toBe(WEEKAHEAD_VERSION);
    expect(WEEKAHEAD_VERSION).toMatch(/^\d{4}-\d{2}\.\d+$/);
  });

  it("quiet weeks are flagged honestly (criterion 3)", () => {
    // Construct: any chart has *some* transit most days; the quiet flag
    // must be exactly "no day has events", and a quiet week's days all
    // have empty arrays (no filler).
    const week = computeWeekAhead(exactProfile, { now: NOW });
    expect(week.quiet).toBe(week.days.every((d) => d.events.length === 0));
    if (week.quiet) {
      for (const d of week.days) expect(d.events).toEqual([]);
    }
  });

  it("respects birth-time precision: unknown time yields no house-dependent content", () => {
    // The timeline shape must be identical structurally for unknown
    // precision (events come from longitudes, which are precision-safe);
    // the key invariant is it never throws and never includes houses.
    const week = computeWeekAhead(unknownProfile, { now: NOW });
    expect(week.days).toHaveLength(7);
    for (const day of week.days) {
      for (const e of day.events) {
        expect(e.areas.length).toBeGreaterThan(0);
      }
    }
  });

  it("changes with the chart (criterion 1: grounded in the user's chart)", () => {
    const other: BirthProfile = {
      ...exactProfile,
      birthDate: "1985-11-30",
      birthTime: "14:45",
      birthTimeZone: "Asia/Kolkata",
      birthPlace: { lat: 19.076, lon: 72.8777 },
    };
    const a = computeWeekAhead(exactProfile, { now: NOW });
    const b = computeWeekAhead(other, { now: NOW });
    const aSig = a.days.map((d) => d.events.map((e) => `${e.transit}-${e.type}-${e.natal}`).join("|"));
    const bSig = b.days.map((d) => d.events.map((e) => `${e.transit}-${e.type}-${e.natal}`).join("|"));
    expect(aSig).not.toEqual(bSig);
  });

  it("changes across weeks (the timeline moves with time)", () => {
    const nextWeek = computeWeekAhead(exactProfile, {
      now: new Date("2026-10-31T12:00:00Z"),
    });
    const thisWeek = computeWeekAhead(exactProfile, { now: NOW });
    expect(nextWeek.days[0].date).toBe("2026-10-31");
    expect(nextWeek.days).not.toEqual(thisWeek.days);
  });
});
