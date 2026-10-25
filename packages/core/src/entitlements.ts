/**
 * Entitlements (ASH-265 / 7.3).
 *
 * Single check pattern: features gate on `entitlements.allows(feature)`,
 * never on hard-coded tiers. The free/paid line is DATA (the default
 * table below, owner-approved 2026-10-25 proposal on the ticket) —
 * changing the boundary is a data change, not a code change. Billing
 * provider is deliberately deferred; this module has none.
 *
 * Free tier retains the complete daily ritual (criterion 2): headline,
 * explanation, dos/don'ts, life areas — everything generated before
 * diveDeeper is free regardless of entitlements.
 */
import type { DailyReading } from "./types";

export type Feature =
  | "daily_reading" // always free — guarded here to make the invariant explicit
  | "dive_deeper"
  | "week_ahead_full"
  | "compatibility_report"
  | "notifications";

export type Tier = "free" | "premium";

/** The owner's proposed free/paid line (ASH-265 ticket comment, 2026-10-25). */
export const DEFAULT_FEATURE_TIERS: Record<Feature, Tier> = {
  daily_reading: "free",
  notifications: "free",
  dive_deeper: "premium",
  week_ahead_full: "premium",
  compatibility_report: "premium",
};

export interface Entitlements {
  tier: Tier;
  /** Overrides of the default line, e.g. a grandfathered feature. */
  featureOverrides?: Partial<Record<Feature, Tier>>;
}

export function defaultEntitlements(): Entitlements {
  return { tier: "free" };
}

/** The single gate. Every premium surface calls this; nothing else. */
export function allows(
  entitlements: Entitlements,
  feature: Feature,
): boolean {
  const tier =
    entitlements.featureOverrides?.[feature] ?? DEFAULT_FEATURE_TIERS[feature];
  if (tier === "free") return true;
  return entitlements.tier === "premium";
}

/**
 * Splits a generated reading into its free slice and premium slice per
 * entitlements. The daily ritual (everything except diveDeeper) is
 * always returned; diveDeeper is included only when allowed.
 */
export function splitReadingForTier(
  reading: DailyReading,
  entitlements: Entitlements,
): DailyReading {
  if (allows(entitlements, "dive_deeper")) return reading;
  const { diveDeeper: _omit, ...freeReading } = reading;
  return freeReading;
}
