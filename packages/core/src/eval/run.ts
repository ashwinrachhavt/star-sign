/**
 * Eval runner (ASH-250 / 3.5c): sweeps the golden set, returns a
 * structured report — profile id, date, rule, offending text — for every
 * failure. Deterministic: same inputs → same report.
 */
import { generateDailyReading } from "../reading";
import { runAllChecks, type EvalFailure } from "./checks";
import { GOLDEN_PROFILES, GOLDEN_DATES } from "./golden-set";
import type { DailyReading } from "../types";

export interface GoldenCase {
  profileId: string;
  date: string;
  reading: DailyReading;
  failures: EvalFailure[];
}

export interface EvalReport {
  cases: GoldenCase[];
  failures: GoldenCase[];
  /** Total readings evaluated. */
  count: number;
}

export function runGoldenSet(): EvalReport {
  const cases: GoldenCase[] = [];
  for (const profile of GOLDEN_PROFILES) {
    for (const date of GOLDEN_DATES) {
      const { id: _id, ...birthProfile } = profile;
      const reading = generateDailyReading({
        profile: birthProfile,
        forDate: date,
      });
      const failures = runAllChecks(reading);
      cases.push({ profileId: profile.id, date, reading, failures });
    }
  }
  return {
    cases,
    failures: cases.filter((c) => c.failures.length > 0),
    count: cases.length,
  };
}
