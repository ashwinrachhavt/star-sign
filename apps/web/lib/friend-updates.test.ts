/**
 * Friend-update derivation tests (W2).
 *
 * The derivation is the privacy boundary for the whole social loop: its
 * output is the ONLY thing the friend-updates route sends about another
 * person. These tests pin the projection allowlist — no raw birth field
 * can ever appear — plus the pipeline-consistency rules (headline from
 * the same reading, area states from the rank vocabulary, honest
 * uncertainty for non-exact birth times).
 */
import { describe, expect, it } from "vitest";
import { deriveFriendUpdate, todayForZone } from "./friend-updates";
import type { BirthProfileRow } from "./readings";

const CONNECTION_ID = "c1a7c56a-1000-4000-8000-000000000001";

const EXACT_ROW: BirthProfileRow = {
  user_id: "u1",
  birth_date: "1991-01-02",
  birth_time: "14:30",
  birth_time_precision: "exact",
  birth_time_zone: "Europe/London",
  birth_lat: 51.5,
  birth_lon: -0.1,
  birth_place_label: "London, UK",
};

const APPROXIMATE_ROW: BirthProfileRow = {
  ...EXACT_ROW,
  birth_time: null,
  birth_time_precision: "approximate",
};

function derive(row: BirthProfileRow, forDate = "2026-11-04") {
  return deriveFriendUpdate({
    connectionId: CONNECTION_ID,
    displayName: "Maya",
    handle: "maya-orion",
    birthRow: row,
    forDate,
  });
}

describe("deriveFriendUpdate", () => {
  it("projects ONLY the allowlist — no raw birth fields in the serialized output", () => {
    const update = derive(EXACT_ROW);
    const serialized = JSON.stringify(update);
    // Raw birth data must not leak in any form: no coordinates, no date,
    // no time, no place label, no zone.
    expect(serialized).not.toContain("51.5");
    expect(serialized).not.toContain("-0.1");
    expect(serialized).not.toContain("1991");
    expect(serialized).not.toContain("14:30");
    expect(serialized).not.toContain("London");
    expect(serialized).not.toContain("Europe/London");
    // Shape: exactly the contracted keys.
    expect(Object.keys(update).sort()).toEqual([
      "basis",
      "connectionId",
      "displayName",
      "handle",
      "headline",
      "lifeAreas",
      "uncertaintyNote",
    ]);
  });

  it("headline is the reading's own headline, at most 12 words", () => {
    const update = derive(EXACT_ROW);
    expect(update.headline.length).toBeGreaterThan(0);
    expect(update.headline.split(/\s+/).length).toBeLessThanOrEqual(12);
  });

  it("life-area states come from the pipeline rank vocabulary", () => {
    const update = derive(EXACT_ROW);
    expect(update.lifeAreas.length).toBeGreaterThan(0);
    for (const area of update.lifeAreas) {
      expect(["hot", "warm", "quiet"]).toContain(area.state);
      expect(typeof area.area).toBe("string");
    }
  });

  it("honors birth-time precision: non-exact times carry the uncertainty note", () => {
    const exact = derive(EXACT_ROW);
    const approximate = derive(APPROXIMATE_ROW);
    expect(exact.basis.precision).toBe("exact");
    expect(approximate.basis.precision).toBe("approximate");
    expect(approximate.uncertaintyNote).toBeTruthy();
    // House-dependent claims soften: the approximate derivation never
    // claims more area rows than the exact one for the same sky.
    expect(approximate.lifeAreas.length).toBeLessThanOrEqual(exact.lifeAreas.length);
  });

  it("different sky, different theme: the areas change across dates", () => {
    const day1 = derive(EXACT_ROW, "2026-11-04");
    const day2 = derive(EXACT_ROW, "2026-12-15");
    expect(JSON.stringify(day1.lifeAreas)).not.toBe(JSON.stringify(day2.lifeAreas));
  });

  it("carries the connection identity and nullable handle", () => {
    const update = derive(EXACT_ROW);
    expect(update.connectionId).toBe(CONNECTION_ID);
    expect(update.displayName).toBe("Maya");
    expect(update.handle).toBe("maya-orion");
    const noHandle = deriveFriendUpdate({
      connectionId: CONNECTION_ID,
      displayName: "Maya",
      handle: null,
      birthRow: EXACT_ROW,
      forDate: "2026-11-04",
    });
    expect(noHandle.handle).toBeNull();
  });
});

describe("todayForZone", () => {
  it("resolves the calendar date in the person's own zone", () => {
    // 23:30 UTC on Nov 4 is already Nov 5 in Tokyo.
    const instant = new Date("2026-11-04T23:30:00Z");
    expect(todayForZone("Asia/Tokyo", instant)).toBe("2026-11-05");
    expect(todayForZone("UTC", instant)).toBe("2026-11-04");
  });
});
