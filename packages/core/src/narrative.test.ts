/**
 * Grounded narrative contract tests (launch wave 1).
 *
 * The contract under test: the prompt may restate ONLY the astrology-
 * engine facts supplied with the request. These tests pin the structure
 * (system prompt carries the binding contract; the user message carries
 * exactly the serialized facts), the refusal path (thin facts → null →
 * no model call), and the output validator (sentinel, prediction filter,
 * length cap).
 */
import { describe, it, expect } from "vitest";
import {
  buildNarrativePrompt,
  buildDailyNarrativeFacts,
  buildWeekNarrativeFacts,
  buildAskNarrativeFacts,
  parseNarrativeOutput,
  NARRATIVE_REFUSAL_SENTINEL,
  NARRATIVE_PROMPT_VERSION,
  type NarrativeFacts,
} from "./narrative.js";
import { generateDailyReading } from "./reading.js";
import { answerQuestion } from "./ask.js";
import { computeNatalChart } from "./chart.js";
import type { BirthProfile, DailyReading } from "./types.js";

const profile: BirthProfile = {
  birthDate: "1990-06-15",
  birthTime: "09:30",
  birthTimePrecision: "exact",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.7128, lon: -74.006 },
};

const FOR_DATE = "2026-10-24";

// A real engine reading — the facts must survive the trip into the prompt.
const reading: DailyReading = generateDailyReading({
  profile,
  forDate: FOR_DATE,
});

describe("buildDailyNarrativeFacts", () => {
  it("maps a real reading into typed facts (headline, areas, pairs, proofs, events)", () => {
    const facts = buildDailyNarrativeFacts({
      forDate: reading.forDate,
      headline: reading.headline,
      explanation: reading.explanation,
      lifeAreas: reading.lifeAreas,
      dos: reading.dos,
      donts: reading.donts,
      provenance: reading.provenance,
      uncertaintyNote: reading.uncertaintyNote,
      diveDeeper: reading.diveDeeper,
    });
    expect(facts).not.toBeNull();
    expect(facts!.scope).toBe("daily");
    expect(facts!.forDate).toBe(FOR_DATE);
    if (facts!.scope !== "daily") return;
    expect(facts!.headline).toBe(reading.headline);
    expect(facts!.explanation).toBe(reading.explanation);
    expect(facts!.lifeAreas).toEqual(
      reading.lifeAreas.map((a) => ({ area: a.area, temperature: a.temperature })),
    );
    expect(facts!.dos).toEqual(reading.dos);
    expect(facts!.donts).toEqual(reading.donts);
    // Proof lines come only from the dive layer's guidance grounding.
    expect(facts!.proofs).toEqual(
      (reading.diveDeeper?.guidance ?? []).map((g) => g.grounding),
    );
  });

  it("drops non-transit provenance events (lunar phases) and maps transit fields", () => {
    const facts = buildDailyNarrativeFacts({
      forDate: FOR_DATE,
      headline: "Headline",
      explanation: "Explanation.",
      lifeAreas: [{ area: "work", temperature: "warm" }],
      dos: ["Do the thing"],
      donts: ["Don't skip it"],
      provenance: {
        selectedEvents: [
          {
            kind: "transit",
            planet: "mars",
            sign: "leo",
            natal: "venus",
            aspect: "square",
            orb: 2.5,
          },
          { kind: "lunar_phase", phase: "waxing gibbous" },
        ],
      },
      uncertaintyNote: "u",
    });
    expect(facts!.scope).toBe("daily");
    if (facts!.scope !== "daily") return;
    expect(facts!.events).toEqual([
      { transit: "mars", transitSign: "leo", natal: "venus", type: "square", orb: 2.5 },
    ]);
  });

  it("refuses when engine facts are absent — no headline, explanation, or areas", () => {
    for (const broken of [
      { headline: "", explanation: "e", lifeAreas: [{ area: "work", temperature: "warm" }] },
      { headline: "h", explanation: "", lifeAreas: [{ area: "work", temperature: "warm" }] },
      { headline: "h", explanation: "e", lifeAreas: [] },
    ]) {
      const facts = buildDailyNarrativeFacts({
        forDate: FOR_DATE,
        ...broken,
        dos: [],
        donts: [],
        provenance: { selectedEvents: [] },
        uncertaintyNote: "u",
      });
      expect(facts).toBeNull();
    }
  });
});

describe("buildWeekNarrativeFacts", () => {
  it("refuses on a quiet week — nothing to narrate, no invented weather", () => {
    expect(
      buildWeekNarrativeFacts({ days: [], quiet: true }),
    ).toBeNull();
  });

  it("carries only the engine's per-day events", () => {
    const facts = buildWeekNarrativeFacts({
      quiet: false,
      days: [
        { date: "2026-11-05", events: [{ transit: "venus", natal: "mars", type: "trine", orb: 1.2, retrograde: false }] },
        { date: "2026-11-06", events: [] },
      ],
    });
    expect(facts).not.toBeNull();
    if (!facts || facts.scope !== "week") return;
    expect(facts.startDate).toBe("2026-11-05");
    expect(facts.endDate).toBe("2026-11-06");
    expect(facts.days).toHaveLength(2);
    expect(facts.days[0].events).toEqual([
      { transit: "venus", natal: "mars", type: "trine", orb: 1.2, retrograde: false },
    ]);
  });
});

describe("buildAskNarrativeFacts", () => {
  const chart = computeNatalChart(profile);

  it("refuses to narrate a refused ask — the deterministic refusal is the answer", () => {
    const refused = answerQuestion("Will I get the job?", {
      chart,
      reading,
      displayName: "Test",
    });
    expect(refused.refused).toBe(true);
    expect(
      buildAskNarrativeFacts({
        question: "Will I get the job?",
        answer: refused,
        selectedEvents: reading.provenance.selectedEvents,
      }),
    ).toBeNull();
  });

  it("supplies the question, citations, and deterministic answer only", () => {
    const answered = answerQuestion("How do I communicate better?", {
      chart,
      reading,
      displayName: "Test",
    });
    const facts = buildAskNarrativeFacts({
      question: "How do I communicate better?",
      answer: answered,
      selectedEvents: reading.provenance.selectedEvents,
    });
    expect(facts).not.toBeNull();
    if (!facts || facts.scope !== "ask") return;
    expect(facts.question).toBe("How do I communicate better?");
    expect(facts.deterministicAnswer).toBe(answered.answer);
    expect(facts.citations).toEqual(answered.citations.map((c) => c.label));
    // Events are the reading's transit events, nothing more.
    const realTransits = reading.provenance.selectedEvents.filter(
      (e) => (e as { kind: string }).kind === "transit",
    );
    expect(facts.events).toHaveLength(realTransits.length);
  });
});

describe("buildNarrativePrompt (grounding shape)", () => {
  const facts = buildDailyNarrativeFacts({
    forDate: reading.forDate,
    headline: reading.headline,
    explanation: reading.explanation,
    lifeAreas: reading.lifeAreas,
    dos: reading.dos,
    donts: reading.donts,
    provenance: reading.provenance,
    uncertaintyNote: reading.uncertaintyNote,
    diveDeeper: reading.diveDeeper,
  })!;

  it("system prompt carries the binding contract: refuse-on-thin-facts and no predictions", () => {
    const { system } = buildNarrativePrompt(facts);
    expect(system).toContain(NARRATIVE_REFUSAL_SENTINEL);
    expect(system).toContain("Never invent a planet, sign, aspect, orb, life area, or event");
    expect(system).toContain("Never predict");
    expect(system).toContain("too thin to narrate honestly");
  });

  it("user message states the supplied facts, line by line", () => {
    const { user } = buildNarrativePrompt(facts);
    expect(user).toContain(`SCOPE: daily`);
    expect(user).toContain(`HEADLINE: ${reading.headline}`);
    expect(user).toContain(`EXPLANATION: ${reading.explanation}`);
    for (const a of reading.lifeAreas) {
      expect(user).toContain(`- ${a.area}: ${a.temperature}`);
    }
    for (const d of reading.dos) expect(user).toContain(`- ${d}`);
    for (const d of reading.donts) expect(user).toContain(`- ${d}`);
    for (const p of facts.proofs) expect(user).toContain(`- ${p}`);
    expect(user).toContain(`UNCERTAINTY: ${reading.uncertaintyNote}`);
  });

  it("user message contains NO chart-section or raw birth data — only supplied facts", () => {
    const { user } = buildNarrativePrompt(facts);
    // CHART FACTS is the ask-scope section; the daily facts never carry
    // natal placements, so the serializer cannot emit one.
    expect(user).not.toContain("CHART FACTS:");
    // Raw birth profile data never enters the prompt.
    expect(user).not.toContain("40.7128");
    expect(user).not.toContain("-74.006");
    expect(user).not.toContain("09:30");
    expect(user).not.toContain("1990-06-15");
  });

  it("every TRANSITS line in a daily prompt traces to a provenance transit event", () => {
    const { user } = buildNarrativePrompt(facts);
    const transitLines = user.split("\n").filter((l) => l.startsWith("- transiting "));
    const provenanceTransits = reading.provenance.selectedEvents.filter(
      (e) => (e as { kind: string }).kind === "transit",
    );
    expect(transitLines).toHaveLength(provenanceTransits.length);
    for (const line of transitLines) {
      // "transiting <planet> [in <sign>] <aspect> natal <natal>"
      const m = line.match(/- transiting (\w+)(?: in (\w+))? (\w+) natal (\w+)/);
      expect(m).toBeTruthy();
      const [, transit, sign, aspect, natal] = m!;
      expect(
        provenanceTransits.some(
          (e) =>
            (e as { planet: string }).planet === transit &&
            (e as { aspect: string }).aspect === aspect &&
            (e as { natal: string }).natal === natal &&
            (sign === undefined || (e as { sign?: string }).sign === sign),
        ),
        `prompt line "${line}" must come from a provenance event`,
      ).toBe(true);
    }
  });

  it("is deterministic for the same facts (cache-key stability)", () => {
    const again = buildDailyNarrativeFacts({
      forDate: reading.forDate,
      headline: reading.headline,
      explanation: reading.explanation,
      lifeAreas: reading.lifeAreas,
      dos: reading.dos,
      donts: reading.donts,
      provenance: reading.provenance,
      uncertaintyNote: reading.uncertaintyNote,
      diveDeeper: reading.diveDeeper,
    })!;
    expect(buildNarrativePrompt(facts)).toEqual(buildNarrativePrompt(again));
  });

  it("week prompts carry only the supplied per-day events", () => {
    const weekFacts: NarrativeFacts = {
      scope: "week",
      startDate: "2026-11-05",
      endDate: "2026-11-06",
      quiet: false,
      days: [
        {
          date: "2026-11-05",
          events: [{ transit: "venus", natal: "mars", type: "trine", orb: 1.2 }],
        },
        { date: "2026-11-06", events: [] },
      ],
    };
    const { user } = buildNarrativePrompt(weekFacts);
    expect(user).toContain("SCOPE: week");
    expect(user).toContain("RANGE: 2026-11-05 through 2026-11-06");
    expect(user).toContain("DAY 2026-11-05:");
    expect(user).toContain("- transiting venus trine natal mars, orb 1.2");
    // Empty days are not narrated into existence.
    expect(user).not.toContain("DAY 2026-11-06:");
  });
});

describe("parseNarrativeOutput", () => {
  it("accepts an in-contract narrative, stripping wrapping quotes", () => {
    expect(parseNarrativeOutput('"Mars squares your Venus today."')).toEqual({
      ok: true,
      narrative: "Mars squares your Venus today.",
    });
  });

  it("honors the refusal sentinel instead of serving it as prose", () => {
    expect(parseNarrativeOutput(NARRATIVE_REFUSAL_SENTINEL)).toEqual({
      ok: false,
      reason: "model_refused",
    });
    expect(
      parseNarrativeOutput(`${NARRATIVE_REFUSAL_SENTINEL} Mars is in Leo.`),
    ).toEqual({ ok: false, reason: "model_refused" });
  });

  it("rejects empty output", () => {
    expect(parseNarrativeOutput("   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects prediction phrasing — the sky describes, it never predicts", () => {
    expect(
      parseNarrativeOutput("The sky is charged. You will win the lottery."),
    ).toEqual({ ok: false, reason: "prediction" });
    // "will" without "you will" is fine.
    expect(parseNarrativeOutput("The sky will feel charged.")).toEqual({
      ok: true,
      narrative: "The sky will feel charged.",
    });
  });

  it("rejects bloated output rather than serving it out-of-contract", () => {
    const bloated = Array(201).fill("word").join(" ");
    expect(parseNarrativeOutput(bloated)).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  it("prompt version is recorded for provenance", () => {
    expect(NARRATIVE_PROMPT_VERSION).toBeTruthy();
  });
});
