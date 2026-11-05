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
    // Dive deeper ships FREE (MVP spec W2b "Pro depth, free", art_g6VLL2Bx
    // 2026-11-04 — supersedes the ASH-265 proposal that paywalled it):
    expect(free.diveDeeper).toEqual(reading.diveDeeper);
  });

  it("life-area temperatures pass through the free-tier split (ASH-268)", () => {
    const reading = generateDailyReading({ profile, forDate: "2026-10-24" });
    const free = splitReadingForTier(reading, defaultEntitlements());
    expect(free.lifeAreas).toEqual(reading.lifeAreas);
    for (const la of free.lifeAreas) {
      expect(["charged", "warm", "steady", "strained"]).toContain(la.temperature);
    }
  });

  it("premium tier keeps dive deeper", () => {
    const reading = generateDailyReading({ profile, forDate: "2026-10-24" });
    const premium = splitReadingForTier(reading, { tier: "premium" });
    if (reading.diveDeeper) {
      expect(premium.diveDeeper).toBeDefined();
    }
  });

  it("single gate pattern: features check allows(), not tiers (criterion 1)", () => {
    // The recorded line — dive_deeper moved to free per MVP spec W2b
    // (art_g6VLL2Bx, 2026-11-04), superseding the 2026-10-25 proposal:
    expect(DEFAULT_FEATURE_TIERS.daily_reading).toBe("free");
    expect(DEFAULT_FEATURE_TIERS.notifications).toBe("free");
    expect(DEFAULT_FEATURE_TIERS.dive_deeper).toBe("free");
    expect(DEFAULT_FEATURE_TIERS.week_ahead_full).toBe("premium");
    expect(DEFAULT_FEATURE_TIERS.compatibility_report).toBe("premium");

    const free = defaultEntitlements();
    expect(allows(free, "daily_reading")).toBe(true);
    expect(allows(free, "notifications")).toBe(true);
    expect(allows(free, "dive_deeper")).toBe(true);

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
    // dive_deeper is free for everyone now (spec W2b) — no override needed:
    expect(allows(grandfathered, "dive_deeper")).toBe(true);
    // without the override, free tier stays locked out of premium features:
    expect(allows({ tier: "free" as const }, "week_ahead_full")).toBe(false);
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
