/**
 * Compatibility-report rule checks (ASH-262 / 6.3).
 *
 * Reuses the EvalFailure shape and spirit of checks.ts (ASH-250) but
 * operates on CompatibilityReport: verdict-language ban, percentage ban,
 * aspect-traceability for relational claims.
 */
import type { CompatibilityReport } from "../types";
import type { EvalFailure } from "./checks";

/**
 * R7 — verdict language (copy.md: symbolic, never factual predictions;
 * hard rule 2 adjacent). Relational verdicts presented as destiny fail.
 */
const VERDICT_PHRASES: RegExp =
  /\b(meant to be|meant for each other|destined|soulmate[s]?|made for each other|written in the stars|perfect match|perfectly matched|always end up|never work|doomed|the universe (wants|intends)|fated)\b/i;

export function checkVerdictLanguage(r: CompatibilityReport): EvalFailure[] {
  const out: EvalFailure[] = [];
  for (const d of r.dimensions) {
    const m = d.summary.match(VERDICT_PHRASES);
    if (m) {
      out.push({
        rule: "no-verdict-language",
        field: `dimensions.${d.area}`,
        text: m[0],
        detail: `relational verdict "${m[0]}" presents astrology as fact (copy.md: symbolic, not predictive)`,
      });
    }
  }
  return out;
}

/**
 * R8 — fabricated numbers in report copy (mirrors ASH-250's R2 on the
 * report surface). Percentages/scores in summaries are always invented.
 */
export function checkReportNumbers(r: CompatibilityReport): EvalFailure[] {
  const out: EvalFailure[] = [];
  for (const d of r.dimensions) {
    const m = d.summary.match(/\d+(\.\d+)?\s*(%|percent|out of \d+|\/\s*\d+|\bpoints\b)/i);
    if (m) {
      out.push({
        rule: "no-fabricated-numbers",
        field: `dimensions.${d.area}`,
        text: m[0],
        detail: "scores/percentages must come from the ruleset; summaries may not invent them",
      });
    }
  }
  return out;
}

/**
 * R9 — "how they see you" traceability (scope item): any second-person
 * relational claim of the shape "they see you", "you come across",
 * "they feel" must be grounded in at least one recorded synastry event
 * between the relevant planets. v1 checks the structural guarantee: if
 * a dimension's summary makes such a claim, its dimension must have
 * contributing events in provenance.selectedEvents (the synastry grid).
 */
const PERCEPTION_RE =
  /\b(they see you|sees you|how they see|you come across|they feel you|they read you|you seem to them)\b/i;

export function checkPerceptionTraceability(
  r: CompatibilityReport,
): EvalFailure[] {
  const out: EvalFailure[] = [];
  const events = r.provenance.selectedEvents;
  for (const d of r.dimensions) {
    if (!PERCEPTION_RE.test(d.summary)) continue;
    // The synastry grid records every cross-chart aspect; a perception
    // claim in a dimension with zero backing events is ungrounded.
    // Dimension→event linkage is via the ruleset's pair spec; structurally
    // we require the report to have events at all, and specifically that
    // SOME event involves the dimension's characteristic planets.
    const DIMENSION_PLANETS: Record<string, string[]> = {
      communication: ["mercury"],
      emotional: ["moon"],
      attraction: ["venus", "mars"],
      friction: ["mars", "saturn"],
      longterm: ["saturn"],
    };
    const planets = DIMENSION_PLANETS[d.area] ?? [];
    const backed = events.some(
      (e) =>
        e.kind === "transit" &&
        (planets.includes(e.planet) || planets.includes(e.natal)),
    );
    if (!backed) {
      out.push({
        rule: "perception-claims-trace-to-aspects",
        field: `dimensions.${d.area}`,
        text: d.summary,
        detail: `"how they see you"-type claim with no synastry aspect involving ${planets.join("/")} in provenance.selectedEvents`,
      });
    }
  }
  return out;
}

/**
 * R10 — tone honesty (types.ts: "derived from aspect weights — never
 * presented as objective fact"): summaries must not assert objective
 * compatibility ("you two are compatible") — they describe interaction
 * styles.
 */
const OBJECTIVE_COMPAT_RE =
  /\b(you (two|both) are|this pairing is|your compatibility is|the relationship is)\s+(highly |very |extremely )?(compatible|incompatible|matched|doomed)\b/i;

export function checkObjectiveClaims(r: CompatibilityReport): EvalFailure[] {
  const out: EvalFailure[] = [];
  for (const d of r.dimensions) {
    const m = d.summary.match(OBJECTIVE_COMPAT_RE);
    if (m) {
      out.push({
        rule: "no-objective-compatibility-claims",
        field: `dimensions.${d.area}`,
        text: m[0],
        detail: "summaries describe interaction styles, never objective verdicts",
      });
    }
  }
  return out;
}

/** All report rules, in reporting order. */
export function runAllReportChecks(r: CompatibilityReport): EvalFailure[] {
  return [
    ...checkVerdictLanguage(r),
    ...checkReportNumbers(r),
    ...checkPerceptionTraceability(r),
    ...checkObjectiveClaims(r),
  ];
}
