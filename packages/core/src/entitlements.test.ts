import { describe, it, expect } from "vitest";
import {
  allows,
  splitReadingForTier,
  defaultEntitlements,
  DEFAULT_FEATURE_TIERS,
  type Feature,
} from "./entitlements.js";
import { generateDailyReading } from "./reading.js";
import type { BirthProfile } from "./types.js";

const profile: BirthProfile = {
  birthDate: "1990-06-15",
  birthTime: "09:30",
  birthTimePrecision: "exact",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.7128, lon: -74.006 },
};

describe("entitlements (ASH-265)", () => {
  it("free tier retains the complete daily ritual (criterion 2)", () => {
    const reading = generateDailyReading({ profile, forDate: "2026-10-24" });
    const free = splitReadingForTier(reading, defaultEntitlements());
    // Ritual fields intact:
    expect(free.headline).toBeTruthy();
    expect(free.explanation).toBeTruthy();
    expect(free.dos.length).toBeGreaterThan(0);
    expect(free.lifeAreas.length).toBeGreaterThan(0);
    // Dive deeper stripped on free:
    expect(free.diveDeeper).toBeUndefined();
  });

  it("premium tier keeps dive deeper", () => {
    const reading = generateDailyReading({ profile, forDate: "2026-10-24" });
    const premium = splitReadingForTier(reading, { tier: "premium" });
    if (reading.diveDeeper) {
      expect(premium.diveDeeper).toBeDefined();
    }
  });

  it("single gate pattern: features check allows(), not tiers (criterion 1)", () => {
    // The recorded line (owner proposal on the ticket):
    expect(DEFAULT_FEATURE_TIERS.daily_reading).toBe("free");
    expect(DEFAULT_FEATURE_TIERS.notifications).toBe("free");
    expect(DEFAULT_FEATURE_TIERS.dive_deeper).toBe("premium");
    expect(DEFAULT_FEATURE_TIERS.week_ahead_full).toBe("premium");
    expect(DEFAULT_FEATURE_TIERS.compatibility_report).toBe("premium");

    const free = defaultEntitlements();
    expect(allows(free, "daily_reading")).toBe(true);
    expect(allows(free, "notifications")).toBe(true);
    expect(allows(free, "dive_deeper")).toBe(false);

    const premium = { tier: "premium" as const };
    expect(allows(premium, "dive_deeper")).toBe(true);
    expect(allows(premium, "compatibility_report")).toBe(true);
  });

  it("feature overrides work (grandfathering without code changes)", () => {
    const grandfathered = {
      tier: "free" as const,
      featureOverrides: { week_ahead_full: "free" as const },
    };
    expect(allows(grandfathered, "week_ahead_full")).toBe(true);
    expect(allows(grandfathered, "dive_deeper")).toBe(false);
  });

  it("every feature has a recorded tier (no unguarded features)", () => {
    const features: Feature[] = [
      "daily_reading",
      "dive_deeper",
      "week_ahead_full",
      "compatibility_report",
      "notifications",
    ];
    for (const f of features) {
      expect(["free", "premium"]).toContain(DEFAULT_FEATURE_TIERS[f]);
    }
  });
});
