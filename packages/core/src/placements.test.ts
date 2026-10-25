import { describe, expect, it } from "vitest";
import {
  interpretPlacements,
  placementPackComplete,
  PLACEMENTS_COPY_VERSION,
  PLANET_MEANINGS,
  SIGN_EXPRESSIONS,
  HOUSE_MEANINGS,
  ASCENDANT_LINES,
} from "./placements";
import { computeNatalChart } from "./chart";
import { PLANETS, ZODIAC_SIGNS, type BirthProfile } from "./types";

const exactProfile: BirthProfile = {
  birthDate: "1990-06-15",
  birthTime: "09:30",
  birthTimePrecision: "exact",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.71, lon: -74.01 },
};

const unknownProfile: BirthProfile = {
  birthDate: "1990-06-15",
  birthTimePrecision: "unknown",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.71, lon: -74.01 },
};

describe("placement pack completeness", () => {
  it("covers every planet, sign, house, and ascendant line", () => {
    expect(placementPackComplete()).toBe(true);
  });

  it("exposes a copy version", () => {
    expect(PLACEMENTS_COPY_VERSION).toMatch(/^\d{4}-\d{2}\.\d+$/);
  });

  it("every planet meaning is a full sentence", () => {
    for (const p of PLANETS) {
      expect(PLANET_MEANINGS[p].endsWith(".")).toBe(true);
      expect(PLANET_MEANINGS[p].split(" ").length).toBeGreaterThan(4);
    }
  });

  it("every sign expression and house meaning is grammatical filler", () => {
    for (const s of ZODIAC_SIGNS) {
      // Written to follow "meaning" — no leading capital, ends with a period.
      expect(SIGN_EXPRESSIONS[s]).toMatch(/^[a-z]/);
      expect(ASCENDANT_LINES[s]).toMatch(/^[a-z]/);
    }
    for (let h = 1; h <= 12; h++) {
      expect(HOUSE_MEANINGS[h]).toMatch(/^[a-z]/);
    }
  });
});

describe("interpretPlacements", () => {
  it("produces one card per planet plus the ascendant (exact time)", () => {
    const chart = computeNatalChart(exactProfile);
    const cards = interpretPlacements(chart, "exact");
    expect(cards).toHaveLength(PLANETS.length + 1);
    expect(cards[0].planet).toBe("ascendant");
    expect(cards[0].title).toMatch(/^Ascendant in /);
    expect(cards[0].house).toBe(1);
  });

  it("titles follow 'Planet in Sign' and paragraphs mention planet meaning and sign", () => {
    const chart = computeNatalChart(exactProfile);
    const cards = interpretPlacements(chart, "exact");
    for (const c of cards.filter((x) => x.planet !== "ascendant")) {
      expect(c.title).toBe(
        c.planet!.charAt(0).toUpperCase() + c.planet!.slice(1) + " in " +
          c.sign.charAt(0).toUpperCase() + c.sign.slice(1),
      );
      // First paragraph = planet meaning + sign expression (FR-02 split).
      expect(c.paragraphs[0]).toContain(PLANET_MEANINGS[c.planet as keyof typeof PLANET_MEANINGS]);
    }
  });

  it("includes house context only when the chart carries houses", () => {
    const chart = computeNatalChart(exactProfile);
    const cards = interpretPlacements(chart, "exact");
    const sun = cards.find((c) => c.planet === "sun")!;
    expect(sun.house).toBeDefined();
    expect(sun.paragraphs.some((p) => /house, meaning/.test(p))).toBe(true);

    const unknownChart = computeNatalChart(unknownProfile);
    const unknownCards = interpretPlacements(unknownChart, "unknown");
    expect(unknownCards[0].planet).not.toBe("ascendant");
    for (const c of unknownCards) {
      expect(c.house).toBeUndefined();
      expect(c.paragraphs.some((p) => /house/.test(p))).toBe(false);
    }
  });

  it("deterministic: same chart, same cards", () => {
    const chart = computeNatalChart(exactProfile);
    const a = interpretPlacements(chart, "exact");
    const b = interpretPlacements(computeNatalChart(exactProfile), "exact");
    expect(a).toEqual(b);
  });
});
