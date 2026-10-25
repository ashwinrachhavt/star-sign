import { describe, it, expect } from "vitest";
import {
  answerQuestion,
  classifyQuestion,
  ASK_MODEL_NAME,
  ASK_MODEL_VERSION,
  type AskContext,
} from "./ask.js";
import { computeNatalChart } from "./chart.js";
import { generateDailyReading } from "./reading.js";
import type { BirthProfile } from "./types.js";

const profile: BirthProfile = {
  birthDate: "1990-06-15",
  birthTime: "09:30",
  birthTimePrecision: "exact",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.7128, lon: -74.006 },
};

const ctx: AskContext = {
  chart: computeNatalChart(profile),
  reading: generateDailyReading({ profile, forDate: "2026-10-24" }),
  displayName: "Test",
};

describe("refusals (criterion 2)", () => {
  it.each([
    "Will I get the job?",
    "When will I meet someone?",
    "I have a health symptom — what does my chart say?",
    "Should I invest in crypto?",
    "Should I sue my landlord?",
    "Predict my future",
  ])("%s → honest refusal", (q) => {
    const out = answerQuestion(q, ctx);
    expect(out.refused).toBe(true);
    expect(out.refusalReason).toBeTruthy();
    expect(out.citations).toHaveLength(0);
  });

  it("classifyQuestion alone flags predictive asks", () => {
    expect(classifyQuestion("When will I move?").refused).toBe(true);
  });
});

describe("grounded answers (criteria 1, 3)", () => {
  it("every answer cites chart facts it drew from", () => {
    const out = answerQuestion("What should I know about my love life?", ctx);
    expect(out.refused).toBe(false);
    expect(out.citations.length).toBeGreaterThan(0);
    // Citations must reference real placements from the chart.
    for (const c of out.citations) {
      if (c.kind === "natal_placement") {
        const sign = c.label.match(/in (\w+)/)?.[1]?.toLowerCase();
        expect(sign).toBeTruthy();
        expect(
          ctx.chart.placements.some((p) => p.sign === sign),
          `citation "${c.label}" must match a real placement`,
        ).toBe(true);
      }
    }
  });

  it("answer mentions only placements present in the chart (criterion 3)", () => {
    const out = answerQuestion("How do I communicate better?", ctx);
    // Every "X in Y" claim in the answer must be a real placement.
    const claims = out.answer.matchAll(/(\w+) in (\w+)/g);
    for (const [, planet, sign] of claims) {
      if (["in"].includes(planet.toLowerCase())) continue;
      const found = ctx.chart.placements.some(
        (p) => p.planet === planet.toLowerCase() && p.sign === sign.toLowerCase(),
      );
      expect(found, `claim "${planet} in ${sign}" must be a real placement`).toBe(true);
    }
  });

  it("today questions cite the stored daily events, not inventions", () => {
    const out = answerQuestion("What's happening today?", ctx);
    expect(out.citations.length).toBeGreaterThan(0);
    const dailyCitations = out.citations.filter((c) => c.kind === "daily_event");
    if (dailyCitations.length > 0) {
      const stored = ctx.reading!.provenance.selectedEvents;
      for (const c of dailyCitations) {
        const matches = stored.some((e) => {
          if (e.kind !== "transit") return false;
          return c.label
            .toLowerCase()
            .includes(`${e.planet}`) && c.label.toLowerCase().includes(`${e.natal}`);
        });
        expect(matches, `"${c.label}" must trace to a stored event`).toBe(true);
      }
    }
  });
});

describe("provenance (criterion 4)", () => {
  it("model name/version + prompt version recorded per answer", () => {
    const out = answerQuestion("Tell me about myself", ctx);
    expect(out.model.name).toBe(ASK_MODEL_NAME);
    expect(out.model.version).toBe(ASK_MODEL_VERSION);
    expect(out.model.promptVersion).toMatch(/^\d+$/);
  });
});
