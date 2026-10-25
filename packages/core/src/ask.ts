/**
 * Ask Star Sign (ASH-266 / 7.4) — bounded Q&A over stored chart facts.
 *
 * The AI boundary is locked (engineering.md rule 2): interpretation only,
 * never computation. v1 implements the boundary WITHOUT an LLM — answers
 * come from deterministic templates over retrieved stored facts, which is
 * trivially compliant with every acceptance criterion:
 *   1. every answer cites the facts it drew from,
 *   2. refusal classifier for out-of-bounds asks,
 *   3. output can only contain facts from the retrieved set (templates
 *      interpolate stored values; they cannot invent placements),
 *   4. "model" = the deterministic ruleset, recorded with a version.
 * Swapping in an LLM later means implementing the same AnswerGenerator
 * port with validated output — the retrieval/refusal/provenance layers
 * stay exactly as they are.
 */
import type { DailyReading, NatalChart, Planet, ZodiacSign } from "./types";
import { PLANETS } from "./types";

export const ASK_RULESET_VERSION = "ask-2026-10.1";
export const ASK_MODEL_NAME = "star-sign-templates";
export const ASK_MODEL_VERSION = ASK_RULESET_VERSION;
export const ASK_PROMPT_VERSION = "1";

export interface AskContext {
  chart: NatalChart;
  reading: DailyReading | null;
  displayName: string;
}

export interface AskCitation {
  kind: "natal_placement" | "daily_event";
  label: string;
}

export interface AskAnswer {
  question: string;
  answer: string;
  citations: AskCitation[];
  refused: boolean;
  refusalReason?: string;
  model: { name: string; version: string; promptVersion: string };
}

export type QuestionTopic =
  | "self"
  | "love"
  | "work"
  | "money"
  | "communication"
  | "today"
  | "unknown";

const TOPIC_BY_KEYWORD: Array<[QuestionTopic, string[]]> = [
  ["love", ["love", "relationship", "partner", "date", "romance", "crush"]],
  ["work", ["work", "job", "career", "boss", "project"]],
  ["money", ["money", "finance", "spend", "save", "buy"]],
  ["communication", ["say", "talk", "conversation", "message", "text", "explain"]],
  ["today", ["today", "tonight", "this evening", "right now"]],
  ["self", ["me", "my", "myself", "i am", "should i"]],
];

const REFUSAL_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\b(will i|when will|predict|future|going to happen|will there)\b/i,
    reason:
      "That's a prediction, and Star Sign doesn't predict. The sky describes weather, not fate — what happens next is yours. I can tell you what today's transits actually say, if you'd like that instead.",
  },
  {
    pattern: /\b(health|sick|illness|diagnos|medicine|symptom|pregnan)\b/i,
    reason:
      "Health questions deserve real medical care, not astrology. Please talk to a doctor. I'm happy to talk about your chart instead.",
  },
  {
    pattern: /\b(invest|stock|crypto|bet|loan|salary|should i buy)\b/i,
    reason:
      "Financial decisions need real financial advice — astrology can't tell you what to do with money. I can talk about what today's sky actually holds.",
  },
  {
    pattern: /\b(lawsue|sue|legal|court|divorce paper|custody)\b/i,
    reason:
      "Legal questions need a lawyer, not a chart. I'm here for the sky, not the courtroom.",
  },
];

export function classifyQuestion(question: string): {
  refused: boolean;
  refusalReason?: string;
  topic: QuestionTopic;
} {
  for (const { pattern, reason } of REFUSAL_PATTERNS) {
    if (pattern.test(question)) {
      return { refused: true, refusalReason: reason, topic: "unknown" };
    }
  }
  const q = question.toLowerCase();
  for (const [topic, keywords] of TOPIC_BY_KEYWORD) {
    if (keywords.some((k) => q.includes(k))) return { refused: false, topic };
  }
  return { refused: false, topic: "self" };
}

/** Retrieves the stored chart facts relevant to a topic. */
export function retrieveFacts(
  ctx: AskContext,
  topic: QuestionTopic,
): { facts: AskCitation[]; planets: Planet[] } {
  const facts: AskCitation[] = [];
  const planets: Planet[] = [];
  for (const p of ctx.chart.placements) {
    facts.push({
      kind: "natal_placement",
      label: `${cap(p.planet)} in ${cap(p.sign)}`,
    });
    planets.push(p.planet);
  }
  if (topic === "today" && ctx.reading) {
    for (const e of ctx.reading.provenance.selectedEvents) {
      if (e.kind === "transit") {
        facts.push({
          kind: "daily_event",
          label: `Transiting ${cap(e.planet)} ${e.aspect ?? "activating"} natal ${cap(e.natal)}`,
        });
        if (!planets.includes(e.planet)) planets.push(e.planet);
      }
    }
  }
  return { facts, planets };
}

const TOPIC_ANSWERS: Record<QuestionTopic, string> = {
  self: "Your {sun} sun and {moon} moon are the spine of the chart — {sunLine}",
  love: "Venus and the moon carry this one. {venusMoonLine}",
  work: "Mars and Saturn run the working day. {marsSaturnLine}",
  money: "Money questions live in the same houses as self-worth — look to Venus and Saturn. {venusSaturnLine}",
  communication: "Mercury is the translator here. {mercuryLine}",
  today: "{todayLine}",
  unknown: "{sunLine}",
};

/**
 * Grounded answer: templates interpolate ONLY retrieved stored values —
 * no placement or aspect can appear that isn't in the fact set
 * (criterion 3, structurally).
 */
export function answerQuestion(
  question: string,
  ctx: AskContext,
): AskAnswer {
  const { refused, refusalReason, topic } = classifyQuestion(question);
  if (refused) {
    return {
      question,
      answer: refusalReason!,
      citations: [],
      refused: true,
      refusalReason,
      model: { name: ASK_MODEL_NAME, version: ASK_MODEL_VERSION, promptVersion: ASK_PROMPT_VERSION },
    };
  }

  const { facts, planets } = retrieveFacts(ctx, topic);
  const placementOf = (p: Planet) =>
    ctx.chart.placements.find((c) => c.planet === p);
  const signOf = (p: Planet) => cap(placementOf(p)?.sign ?? "unknown");
  const has = (p: Planet) => planets.includes(p);

  const lines: string[] = [];
  const sunLine = `your ${signOf("sun")} sun keeps the center of gravity where you put it`;
  const venusMoonLine = `your ${signOf("venus")} Venus and ${signOf("moon")} moon describe what you warm to and what you need`;
  const marsSaturnLine = `your ${signOf("mars")} Mars sets the pace, your ${signOf("saturn")} Saturn sets the standard`;
  const venusSaturnLine = `your ${signOf("venus")} Venus enjoys, your ${signOf("saturn")} Saturn commits`;
  const mercuryLine = `your ${signOf("mercury")} Mercury colors every word you choose`;

  let todayLine = "today's sky is quiet against your chart";
  if (topic === "today" && ctx.reading?.diveDeeper?.decoded.length) {
    todayLine = ctx.reading.diveDeeper.decoded
      .slice(0, 2)
      .map((d) => d.explanation)
      .join(" ");
  } else if (topic === "today" && ctx.reading) {
    todayLine = ctx.reading.explanation;
  }

  const template = TOPIC_ANSWERS[topic];
  let answer = template
    .replace("{sun}", signOf("sun"))
    .replace("{sunLine}", sunLine)
    .replace("{venusMoonLine}", venusMoonLine)
    .replace("{marsSaturnLine}", marsSaturnLine)
    .replace("{venusSaturnLine}", venusSaturnLine)
    .replace("{mercuryLine}", mercuryLine)
    .replace("{todayLine}", todayLine);

  // Grounding footer: honesty about what this is.
  answer +=
    " — read as weather, not verdict. The sky describes; you decide.";

  // Criterion 1: citations are exactly the retrieved facts.
  return {
    question,
    answer,
    citations: facts,
    refused: false,
    model: { name: ASK_MODEL_NAME, version: ASK_MODEL_VERSION, promptVersion: ASK_PROMPT_VERSION },
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
