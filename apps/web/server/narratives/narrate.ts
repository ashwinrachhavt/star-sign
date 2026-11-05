/**
 * Narrative cache + generation (SERVER-ONLY — launch wave 1).
 *
 * One generated narrative per (user, scope, forDate[, variant]): the
 * ai_narratives row is the durable cache (migration 0019), mirroring the
 * daily-readings idempotency pattern (unique constraint → race readback).
 * The model is called only on a cache miss, and only when admitGeneration
 * admits the request — the route wires its per-user rate limiter there,
 * so cache hits never burn generation budget.
 */
import { createHash } from "node:crypto";
import {
  buildNarrativePrompt,
  parseNarrativeOutput,
  NARRATIVE_MODEL_NAME,
  NARRATIVE_PROMPT_VERSION,
  MERCURY_MODEL,
  type NarrativeAdapter,
  type NarrativeFacts,
  type NarrativeScope,
} from "./mercury";

/** Persistence boundary the orchestrator needs — satisfied by Supabase. */
export interface NarrativeStore {
  /** The cached narrative for the key, or null. */
  findNarrative(
    userId: string,
    scope: NarrativeScope,
    forDate: string,
    variant: string,
  ): Promise<string | null>;
  /**
   * Persists a generated narrative. ok:false with code "23505" means
   * another request won the unique race (daily-readings convention).
   */
  insertNarrative(row: {
    userId: string;
    scope: NarrativeScope;
    forDate: string;
    variant: string;
    narrative: string;
    factsDigest: string;
  }): Promise<{ ok: true } | { ok: false; code?: string }>;
}

export type NarrativeSource =
  | "cache" // served from the ai_narratives row
  | "generated" // model called this request, then cached
  | "unavailable" // adapter failed (unconfigured/down) — honest null
  | "refused" // contract refused: thin facts, sentinel, or out-of-contract output
  | "rate_limited"; // admitGeneration declined the cache miss

export interface NarrativeOutcome {
  narrative: string | null;
  source: NarrativeSource;
}

/**
 * Cache-first narrative retrieval. The facts were already validated as
 * sufficient by the fact builders (a null facts never reaches here —
 * callers degrade before calling); this module generates, validates the
 * output against the contract, and caches.
 */
export async function getOrGenerateNarrative(deps: {
  store: NarrativeStore;
  adapter: NarrativeAdapter;
  userId: string;
  scope: NarrativeScope;
  forDate: string;
  /** Key suffix for per-item scope variants (ask: the question digest). */
  variant?: string;
  facts: NarrativeFacts;
  /** Returns false to refuse a cache miss (per-user generation budget). */
  admitGeneration?: () => boolean;
}): Promise<NarrativeOutcome> {
  const variant = deps.variant ?? "";

  const cached = await deps.store.findNarrative(
    deps.userId,
    deps.scope,
    deps.forDate,
    variant,
  );
  if (cached !== null) return { narrative: cached, source: "cache" };

  if (deps.admitGeneration && !deps.admitGeneration()) {
    return { narrative: null, source: "rate_limited" };
  }

  const prompt = buildNarrativePrompt(deps.facts);
  const result = await deps.adapter.generate(prompt);
  if (!result.ok) {
    // Provider failure is logged, never swallowed silently — the route
    // degrades to a null narrative either way.
    console.error(
      `[narratives] generation failed (${deps.scope}/${deps.forDate}): ${result.reason}`,
    );
    return { narrative: null, source: "unavailable" };
  }

  const parsed = parseNarrativeOutput(result.text);
  if (!parsed.ok) {
    console.error(
      `[narratives] contract parse failed (${deps.scope}/${deps.forDate}): ${parsed.reason}`,
    );
    return { narrative: null, source: "refused" };
  }

  // Provenance: the digest of the exact supplied facts this narrative
  // restates — auditable against the reading's provenance later.
  const factsDigest = createHash("sha256").update(prompt.user).digest("hex");

  const inserted = await deps.store.insertNarrative({
    userId: deps.userId,
    scope: deps.scope,
    forDate: deps.forDate,
    variant,
    narrative: parsed.narrative,
    factsDigest,
  });
  if (!inserted.ok && inserted.code === "23505") {
    // Another request generated and stored first — serve the stored one.
    const raced = await deps.store.findNarrative(
      deps.userId,
      deps.scope,
      deps.forDate,
      variant,
    );
    if (raced !== null) return { narrative: raced, source: "cache" };
  }

  return { narrative: parsed.narrative, source: "generated" };
}

/** Model identity recorded with every cached narrative. */
export function narrativeModelIdentity(): {
  name: string;
  version: string;
  promptVersion: string;
} {
  return {
    name: NARRATIVE_MODEL_NAME,
    version: MERCURY_MODEL,
    promptVersion: NARRATIVE_PROMPT_VERSION,
  };
}
