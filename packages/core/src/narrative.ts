/**
 * Grounded narrative contract (launch wave 1: Mercury narratives).
 *
 * The AI boundary (engineering.md rule 2, ask.ts precedent): the engine
 * computes, the narrator restates. Mercury sees ONLY the facts the
 * astrology engine produced for this request — transits, four-state area
 * states, paired do/don'ts, proof lines — and its system prompt binds it
 * to restate those or refuse. Nothing here calls the network: the prompt
 * builder and the output validator are pure, so the grounding contract is
 * unit-testable without a provider. The HTTP adapter lives in the web
 * app (apps/web/server/narratives/), mirroring the push-adapter port.
 *
 * Strictness is structural: buildNarrativePrompt serializes the supplied
 * facts and nothing else — no fact can enter the prompt without passing
 * through a typed field on NarrativeFacts.
 */

/** Version of the narrative prompt contract (bump on any system-prompt change). */
export const NARRATIVE_PROMPT_VERSION = "1";

/** Model identity recorded alongside cached narratives (provenance). */
export const NARRATIVE_MODEL_NAME = "mercury";

/**
 * The model's escape hatch: when the supplied facts are too thin to
 * narrate honestly, the contract requires exactly this token instead of
 * improvisation. Parsed back out by parseNarrativeOutput.
 */
export const NARRATIVE_REFUSAL_SENTINEL = "[NO NARRATIVE]";

/** Upper bound on an in-contract narrative; longer output is a violation. */
export const NARRATIVE_MAX_WORDS = 200;

export type NarrativeScope = "daily" | "week" | "ask";

/** One transit event, stated as the engine saw it. */
export interface NarrativeEventFact {
  transit: string;
  /** Current sign of the transiting planet, when the engine supplied it. */
  transitSign?: string;
  natal: string;
  type: string;
  orb?: number;
  retrograde?: boolean;
}

export type NarrativeFacts =
  | {
      scope: "daily";
      forDate: string;
      headline: string;
      explanation: string;
      lifeAreas: Array<{ area: string; temperature: string }>;
      dos: string[];
      donts: string[];
      /** Proof lines (the named transit + meaning behind each do/don't pair). */
      proofs: string[];
      events: NarrativeEventFact[];
      uncertaintyNote: string;
    }
  | {
      scope: "week";
      startDate: string;
      endDate: string;
      quiet: boolean;
      days: Array<{ date: string; events: NarrativeEventFact[] }>;
    }
  | {
      scope: "ask";
      question: string;
      /** The deterministic engine answer the narrative enriches. */
      deterministicAnswer: string;
      /** Retrieved chart facts, as cited by the engine. */
      citations: string[];
      events: NarrativeEventFact[];
    };

// ---------------------------------------------------------------------------
// Fact builders — engine output → NarrativeFacts, or null when the engine
// facts are too thin to narrate (the refusal path: no call is made).
// ---------------------------------------------------------------------------

/**
 * Facts for the daily narrative. Returns null when the reading does not
 * carry enough engine facts to narrate honestly (missing reading, no
 * explanation, no area states) — the caller must degrade, never improvise.
 */
export function buildDailyNarrativeFacts(reading: {
  forDate: string;
  headline: string;
  explanation: string;
  lifeAreas: Array<{ area: string; temperature: string }>;
  dos: string[];
  donts: string[];
  provenance: { selectedEvents: unknown[] };
  uncertaintyNote: string;
  diveDeeper?: { guidance?: Array<{ grounding: string }> } | undefined;
}): NarrativeFacts | null {
  const hasFacts =
    reading.headline.trim().length > 0 &&
    reading.explanation.trim().length > 0 &&
    reading.lifeAreas.length > 0;
  if (!hasFacts) return null;

  return {
    scope: "daily",
    forDate: reading.forDate,
    headline: reading.headline,
    explanation: reading.explanation,
    lifeAreas: reading.lifeAreas.map((a) => ({
      area: a.area,
      temperature: a.temperature,
    })),
    dos: [...reading.dos],
    donts: [...reading.donts],
    proofs: (reading.diveDeeper?.guidance ?? [])
      .map((g) => g.grounding)
      .filter((s) => s.trim().length > 0),
    events: eventsFromSelected(reading.provenance.selectedEvents),
    uncertaintyNote: reading.uncertaintyNote,
  };
}

/**
 * Facts for the week-ahead narrative. A quiet week is not an error — but
 * there is nothing to narrate, so null (the caller degrades to the
 * deterministic quiet-week copy; no model call, no invented weather).
 */
export function buildWeekNarrativeFacts(week: {
  days: Array<{ date: string; events: NarrativeEventFact[] }>;
  quiet: boolean;
}): NarrativeFacts | null {
  if (week.quiet) return null;
  return {
    scope: "week",
    startDate: week.days[0]?.date ?? "",
    endDate: week.days[week.days.length - 1]?.date ?? "",
    quiet: false,
    days: week.days.map((d) => ({ date: d.date, events: [...d.events] })),
  };
}

/**
 * Facts for a richer Ask answer. Refused asks are never narrated — the
 * deterministic refusal IS the answer (null). The narrative only ever
 * enriches an answered, cited question.
 */
export function buildAskNarrativeFacts(args: {
  question: string;
  answer: {
    refused: boolean;
    answer: string;
    citations: Array<{ label: string }>;
  };
  selectedEvents: unknown[];
}): NarrativeFacts | null {
  if (args.answer.refused) return null;
  return {
    scope: "ask",
    question: args.question,
    deterministicAnswer: args.answer.answer,
    citations: args.answer.citations.map((c) => c.label),
    events: eventsFromSelected(args.selectedEvents),
  };
}

/** Provenance transit events → narrative event facts (typed, no extras). */
function eventsFromSelected(selected: unknown[]): NarrativeEventFact[] {
  const events: NarrativeEventFact[] = [];
  for (const e of selected) {
    if (!e || typeof e !== "object") continue;
    const rec = e as Record<string, unknown>;
    if (rec.kind !== "transit") continue;
    events.push({
      transit: String(rec.planet ?? ""),
      ...(typeof rec.sign === "string" ? { transitSign: rec.sign } : {}),
      natal: String(rec.natal ?? ""),
      type: String(rec.aspect ?? "activating"),
      ...(typeof rec.orb === "number" ? { orb: rec.orb } : {}),
    });
  }
  return events.filter((e) => e.transit.length > 0 && e.natal.length > 0);
}

// ---------------------------------------------------------------------------
// Prompt builder — the grounding contract, serialized.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Star Sign's narrator. You write a short second-person passage that restates the astrological facts supplied in this conversation — nothing else.

Grounding contract (binding):
1. Every astrological claim must trace to the supplied FACTS. You may connect and interpret only what is listed there.
2. Never invent a planet, sign, aspect, orb, life area, or event the supplied facts do not contain. Never add dates, times, or numbers.
3. Never predict. The sky describes weather, not fate: no "you will", no guarantees, no prophecy.
4. If the supplied facts are missing, empty, or too thin to narrate honestly, do not improvise and do not pad: reply with exactly ${NARRATIVE_REFUSAL_SENTINEL} and nothing else.
5. Health, legal, and financial decisions are out of scope: redirect to a professional in one sentence, or reply ${NARRATIVE_REFUSAL_SENTINEL}.

Voice: Star Sign's own — second person, short declaratives, blunt, concrete nouns, no hedging, no emoji, no markdown, no headings. At most 120 words.`;

/**
 * Builds the two-message prompt. The system message is the fixed contract;
 * the user message is ONLY the serialized supplied facts (each fact one
 * line) — the structural guarantee that no fact can be narrated without
 * having been supplied.
 */
export function buildNarrativePrompt(facts: NarrativeFacts): {
  system: string;
  user: string;
} {
  return { system: SYSTEM_PROMPT, user: serializeFacts(facts) };
}

function serializeFacts(facts: NarrativeFacts): string {
  switch (facts.scope) {
    case "daily": {
      const lines = [
        `SCOPE: daily`,
        `DATE: ${facts.forDate}`,
        `HEADLINE: ${facts.headline}`,
        `EXPLANATION: ${facts.explanation}`,
        `AREA STATES:`,
        ...facts.lifeAreas.map(
          (a) => `- ${a.area}: ${a.temperature}`,
        ),
      ];
      if (facts.dos.length > 0) {
        lines.push(`DOS:`, ...facts.dos.map((d) => `- ${d}`));
      }
      if (facts.donts.length > 0) {
        lines.push(`DONTS:`, ...facts.donts.map((d) => `- ${d}`));
      }
      if (facts.proofs.length > 0) {
        lines.push(`PROOF LINES:`, ...facts.proofs.map((p) => `- ${p}`));
      }
      lines.push(...eventLines(facts.events));
      lines.push(`UNCERTAINTY: ${facts.uncertaintyNote}`);
      return lines.join("\n");
    }
    case "week": {
      const lines = [
        `SCOPE: week`,
        `RANGE: ${facts.startDate} through ${facts.endDate}`,
      ];
      for (const day of facts.days) {
        if (day.events.length === 0) continue;
        lines.push(`DAY ${day.date}:`);
        lines.push(...eventLines(day.events, "  "));
      }
      lines.push(
        `NOTE: narrate the week's shape from these events only; days without events stay unmentioned.`,
      );
      return lines.join("\n");
    }
    case "ask": {
      return [
        `SCOPE: ask`,
        `QUESTION: ${facts.question}`,
        `CHART FACTS:`,
        ...facts.citations.map((c) => `- ${c}`),
        ...eventLines(facts.events),
        `DETERMINISTIC ANSWER: ${facts.deterministicAnswer}`,
        `NOTE: enrich the answer above in your own words without adding any fact it does not contain.`,
      ].join("\n");
    }
  }
}

function eventLines(events: NarrativeEventFact[], indent = ""): string[] {
  if (events.length === 0) return [];
  return [
    `${indent}TRANSITS:`,
    ...events.map(
      (e) =>
        `${indent}- transiting ${e.transit}${e.transitSign ? ` in ${e.transitSign}` : ""} ${e.type} natal ${e.natal}${typeof e.orb === "number" ? `, orb ${e.orb}` : ""}${e.retrograde ? ", retrograde" : ""}`,
    ),
  ];
}

// ---------------------------------------------------------------------------
// Output validator — the model's reply must honor the contract.
// ---------------------------------------------------------------------------

export type NarrativeParseResult =
  | { ok: true; narrative: string }
  | { ok: false; reason: "model_refused" | "empty" | "too_long" | "prediction" };

/**
 * Validates a narrator reply against the contract: the refusal sentinel
 * is honored (not stripped or padded), emptiness fails, and a bloated or
 * predicting reply is rejected rather than served out-of-contract.
 */
export function parseNarrativeOutput(raw: string): NarrativeParseResult {
  const text = stripWrappingQuotes(raw.trim());
  if (text.length === 0) return { ok: false, reason: "empty" };
  if (text.startsWith(NARRATIVE_REFUSAL_SENTINEL)) {
    return { ok: false, reason: "model_refused" };
  }
  if (/\byou will\b/i.test(text)) return { ok: false, reason: "prediction" };
  if (countWords(text) > NARRATIVE_MAX_WORDS) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, narrative: text };
}

function stripWrappingQuotes(text: string): string {
  const quoted = /^"([\s\S]*)"$/.exec(text);
  return quoted ? quoted[1].trim() : text;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}
