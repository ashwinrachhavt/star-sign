import { describe, it, expect } from "vitest";
import { runGoldenSet, type GoldenCase } from "./run";
import {
  checkCertaintyInflation,
  checkFabricatedNumbers,
  checkHeadlineLength,
  checkMathContradiction,
  checkStructure,
} from "./checks";
import { GOLDEN_PROFILES, GOLDEN_DATES } from "./golden-set";
import { generateDailyReading } from "../reading";
import type { DailyReading } from "../types";

/**
 * Reading quality eval harness (ASH-250). Runs the golden set through
 * the copy rules so regressions block merge (AC 1). The stored snapshot
 * is the regression baseline (AC 4) — update it ONLY with owner review.
 */

describe("ASH-250 golden set integrity", () => {
  it("has 10 profiles × 5 dates with mixed precisions", () => {
    expect(GOLDEN_PROFILES).toHaveLength(10);
    expect(GOLDEN_DATES).toHaveLength(5);
    const precisions = GOLDEN_PROFILES.map((p) => p.birthTimePrecision);
    expect(precisions.filter((p) => p === "exact")).toHaveLength(4);
    expect(precisions.filter((p) => p === "approximate")).toHaveLength(3);
    expect(precisions.filter((p) => p === "unknown")).toHaveLength(3);
  });
});

describe("ASH-250 rule checks fire on crafted bad readings (AC 2, 3)", () => {
  const base = generateDailyReading({
    profile: GOLDEN_PROFILES[0],
    forDate: GOLDEN_DATES[3],
  });

  const withFields = (over: Partial<DailyReading>): DailyReading => ({
    ...base,
    ...over,
    provenance: base.provenance,
  });

  it("R1: 'guaranteed'/'destined' fail with a named rule", () => {
    const failures = checkCertaintyInflation(
      withFields({ explanation: "This alignment is guaranteed to work out." }),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe("no-certainty-inflation");
    expect(failures[0].text.toLowerCase()).toContain("guaranteed");

    const d = checkCertaintyInflation(
      withFields({ headline: "A day destined for greatness." }),
    );
    expect(d).toHaveLength(1);
    expect(d[0].rule).toBe("no-certainty-inflation");
    expect(d[0].field).toBe("headline");
  });

  it("R2: invented percentages fail with a named rule", () => {
    const failures = checkFabricatedNumbers(
      withFields({ dos: ["Trust this 87% of the time."] }),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe("no-fabricated-numbers");
  });

  it("R3: a 13-word headline fails the ceiling", () => {
    const long = Array(13).fill("word").join(" ");
    const failures = checkHeadlineLength(withFields({ headline: long }));
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe("headline-max-12-words");
  });

  it("R4: prose contradicting engine facts fails (criterion 3)", () => {
    // Claim an aspect pair that cannot be in provenance for this reading.
    const failures = checkMathContradiction(
      withFields({
        explanation:
          "Pluto retrograde meets your natal Sun. Whatever that part of life holds, it speaks up today. Your sign colors the day.",
      }),
    );
    expect(failures.length).toBeGreaterThanOrEqual(1);
    expect(failures[0].rule).toBe("prose-matches-engine-facts");
    // And the retro-claim without a backing event also fires:
    const retroOnly = checkMathContradiction(
      withFields({ explanation: "Venus retrograde is here. Reflect on love." }),
    );
    expect(retroOnly.some((f) => f.rule === "prose-matches-engine-facts")).toBe(true);
  });

  it("R4 passes on truthful prose (the chosen event's own explanation)", () => {
    // The generated reading's own explanation must never contradict its
    // provenance — the negative test would catch a broken generator.
    const r = generateDailyReading({
      profile: GOLDEN_PROFILES[1],
      forDate: GOLDEN_DATES[0],
    });
    expect(checkMathContradiction(r)).toEqual([]);
  });

  it("R6: unknown life area and over-long dos fail structure", () => {
    const failures = checkStructure(
      withFields({ lifeAreas: [{ area: "career" as never, temperature: "hot" as const }] }),
    );
    expect(failures.some((f) => f.rule === "structure-limits" && f.text === "career")).toBe(true);
  });

  it("R6b: invalid life-area temperature fails structure (ASH-268)", () => {
    const failures = checkStructure(
      withFields({
        lifeAreas: [{ area: "work", temperature: "scorching" as never }],
      }),
    );
    expect(failures.some((f) => f.rule === "structure-limits" && f.detail.includes("temperature"))).toBe(true);
  });
});

describe("ASH-250 golden-set eval (CI gate)", () => {
  const report = runGoldenSet();

  it("evaluates all 50 cases", () => {
    expect(report.count).toBe(50);
  });

  it("every reading passes every rule (structured report on failure)", () => {
    // The fix-back loop (3.5c): on failure, print the full structured
    // report — profile, date, rule, offending text — then fail.
    if (report.failures.length > 0) {
      const lines = report.failures.flatMap((c: GoldenCase) =>
        c.failures.map(
          (f) =>
            `[${c.profileId} @ ${c.date}] rule=${f.rule} field=${f.field} text="${f.text}" — ${f.detail}`,
        ),
      );
      console.error("EVAL FAILURES:\n" + lines.join("\n"));
    }
    expect(report.failures).toEqual([]);
  });

  it("readings are deterministic across runs (baseline stability)", () => {
    const again = runGoldenSet();
    expect(again.cases).toEqual(report.cases);
  });

  it("stores the snapshot baseline (AC 4 — update only with owner review)", () => {
    const snapshot = report.cases.map((c) => ({
      profileId: c.profileId,
      date: c.date,
      headline: c.reading.headline,
      lifeAreas: c.reading.lifeAreas,
      dosCount: c.reading.dos.length,
      dontsCount: c.reading.donts.length,
      rulesetVersion: c.reading.provenance.rulesetVersion,
    }));
    expect(snapshot).toMatchSnapshot();
  });
});
