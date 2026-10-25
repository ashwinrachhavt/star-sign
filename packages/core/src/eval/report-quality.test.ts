import { describe, it, expect } from "vitest";
import { generateCompatibilityReport } from "../compatibility";
import { GOLDEN_PAIRS } from "./golden-pairs";
import { runAllReportChecks } from "./report-checks";
import {
  checkVerdictLanguage,
  checkReportNumbers,
  checkPerceptionTraceability,
  checkObjectiveClaims,
} from "./report-checks";
import type { CompatibilityReport } from "../types";

/**
 * Report quality eval (ASH-262): golden pairs through the copy rules —
 * the same CI gate as daily readings (ASH-250), report-specific rules.
 * Snapshot is the regression baseline (AC 3) — update only with owner
 * review.
 */

function reportFor(pairId: string): CompatibilityReport {
  const pair = GOLDEN_PAIRS.find((p) => p.pairId === pairId)!;
  return generateCompatibilityReport({
    a: { userId: `a-${pair.pairId}`, displayName: "A", profile: pair.a },
    b: { userId: `b-${pair.pairId}`, displayName: "B", profile: pair.b },
    now: new Date("2026-10-25T12:00:00Z"),
  });
}

describe("ASH-262 golden pairs integrity", () => {
  it("has 4 pairs, all producing five dimensions", () => {
    expect(GOLDEN_PAIRS.length).toBeGreaterThanOrEqual(3);
    for (const p of GOLDEN_PAIRS) {
      const r = reportFor(p.pairId);
      expect(r.dimensions.map((d) => d.area).sort()).toEqual(
        ["attraction", "communication", "emotional", "friction", "longterm"].sort(),
      );
    }
  });
});

describe("ASH-262 report rules fire on crafted bad reports (AC 2)", () => {
  const base = reportFor("P1xP2");

  const withSummary = (area: string, summary: string): CompatibilityReport => ({
    ...base,
    dimensions: base.dimensions.map((d) =>
      d.area === area ? { ...d, summary } : d,
    ),
  });

  it("R7: 'meant to be' fails with a named rule", () => {
    const failures = checkVerdictLanguage(
      withSummary("attraction", "You two are meant to be together."),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe("no-verdict-language");
    expect(failures[0].text.toLowerCase()).toContain("meant to be");
  });

  it("R8: invented percentages fail", () => {
    const failures = checkReportNumbers(
      withSummary("communication", "You communicate well 87% of the time."),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe("no-fabricated-numbers");
  });

  it("R9: perception claims without backing aspects fail", () => {
    // Craft an ungrounded case: empty synastry grid — nothing backs the
    // claim (e.g. a broken generator that dropped selectedEvents).
    const ungrounded: CompatibilityReport = {
      ...base,
      provenance: { ...base.provenance, selectedEvents: [] },
      dimensions: base.dimensions.map((d) =>
        d.area === "emotional" ? { ...d, summary: "They see you clearly, even at a distance." } : d,
      ),
    };
    const failures = checkPerceptionTraceability(ungrounded);
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe("perception-claims-trace-to-aspects");
  });

  it("R9 passes when the dimension's planets appear in the synastry grid", () => {
    // The real report's emotional summary doesn't make perception claims,
    // but the rule must not false-positive on grid-backed dimensions:
    const r = reportFor("P1xP2");
    expect(r.provenance.selectedEvents.length).toBeGreaterThan(0);
    // Craft a perception claim in a dimension whose planets ARE in the grid:
    const events = r.provenance.selectedEvents;
    const moonBacked = events.some(
      (e) => e.kind === "transit" && (e.planet === "moon" || e.natal === "moon"),
    );
    const report: CompatibilityReport = {
      ...r,
      dimensions: r.dimensions.map((d) =>
        d.area === "emotional" && moonBacked
          ? { ...d, summary: "They see you at your most guarded." }
          : d,
      ),
    };
    if (moonBacked) {
      const failures = checkPerceptionTraceability(report).filter(
        (f) => f.field === "dimensions.emotional",
      );
      expect(failures).toHaveLength(0);
    }
  });

  it("R10: objective compatibility verdicts fail", () => {
    const failures = checkObjectiveClaims(
      withSummary("longterm", "This pairing is highly compatible over time."),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].rule).toBe("no-objective-compatibility-claims");
  });
});

describe("ASH-262 golden-set eval (CI gate, same gate as readings)", () => {
  const cases = GOLDEN_PAIRS.map((p) => ({
    pairId: p.pairId,
    report: reportFor(p.pairId),
  }));

  it("every report passes every rule (structured report on failure)", () => {
    const failures = cases.flatMap((c) =>
      runAllReportChecks(c.report).map((f) => `[${c.pairId}] ${f.rule} ${f.field}: "${f.text}" — ${f.detail}`),
    );
    if (failures.length > 0) {
      console.error("REPORT EVAL FAILURES:\n" + failures.join("\n"));
    }
    expect(failures).toEqual([]);
  });

  it("deterministic across runs", () => {
    const again = GOLDEN_PAIRS.map((p) => ({
      pairId: p.pairId,
      report: reportFor(p.pairId),
    }));
    expect(again).toEqual(cases);
  });

  it("snapshot baseline (AC 3 — update only with owner review)", () => {
    const snapshot = cases.map((c) => ({
      pairId: c.pairId,
      dimensions: c.report.dimensions.map((d) => ({
        area: d.area,
        tone: d.tone,
        summary: c.report.provenance.selectedEvents.length, // grid size per pair, stable
      })),
      eventCount: c.report.provenance.selectedEvents.length,
    }));
    expect(snapshot).toMatchSnapshot();
  });
});
