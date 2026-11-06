/**
 * POST /api/narratives — grounded narrative over the day's or week's
 * engine facts (launch wave 1).
 *
 * The narrative layer NEVER computes astrology: facts are assembled from
 * the persisted daily reading (or the deterministic week-ahead compute)
 * by the core fact builders, and Mercury may only restate them. Cache
 * and rate limits live server-side; the key never reaches the client.
 *
 * Response envelope: { narrative: string | null, source } where source
 * says how to read a null — "refused" (thin engine facts; the
 * deterministic surface already carries the day), "unavailable"
 * (provider down/unconfigured), "rate_limited" (generation budget
 * spent; a cache hit would still serve). Null → the UI renders
 * nothing; it never fabricates a stand-in.
 */
import { z } from "zod";
import {
  allows,
  buildDailyNarrativeFacts,
  buildWeekNarrativeFacts,
  computeWeekAhead,
  defaultEntitlements,
} from "@star-sign/core";
import { getOrGenerateNarrative } from "@/server/narratives/narrate";
import { supabaseNarrativeStore } from "@/server/narratives/store";
import { MercuryNarrativeAdapter } from "@/server/narratives/mercury";
import { readingFromRow, rowToBirthProfile } from "@/lib/readings";
import {
  jsonError,
  jsonOk,
  parseBody,
  rateLimit,
  rateLimitResponse,
  RATE_LIMITS,
  requestId,
  requireActor,
} from "../_lib/api";

const narrativeRequestSchema = z
  .object({
    scope: z.enum(["daily", "week"]),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
      .optional(),
  })
  .strict();

/**
 * The caller's entitlements. Billing is deliberately deferred (no plan
 * column, no provider — entitlements.ts), so today this is the default
 * line for every user; when billing lands, this function is the ONE
 * place that becomes a per-user lookup.
 */
function entitlementsForUser() {
  return defaultEntitlements();
}

export async function POST(req: Request) {
  const reqId = requestId();

  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  // Request-level throttle (any narrative request, hit or miss). The
  // model-call budget is enforced separately at admitGeneration below —
  // cache hits never burn it.
  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const parsed = await parseBody(req, narrativeRequestSchema, reqId);
  if (!parsed.ok) return parsed.response;

  const entitlements = entitlementsForUser();

  const { data: profileRow } = await actor.supabase
    .from("birth_profiles")
    .select("*")
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (!profileRow) {
    return jsonError(409, "conflict", "Complete onboarding first.", reqId);
  }

  const forDate =
    parsed.data.date ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: profileRow.birth_time_zone,
    }).format(new Date());

  const profile = rowToBirthProfile(profileRow);

  // Facts first — the grounding contract requires a refusal BEFORE the
  // model is ever consulted when the engine's facts are thin.
  let facts;
  if (parsed.data.scope === "daily") {
    // The single gate pattern: daily_reading is the free-tier ritual.
    if (!allows(entitlements, "daily_reading")) {
      return jsonError(403, "forbidden", "Not in your plan.", reqId);
    }
    const { data: readingRow } = await actor.supabase
      .from("daily_readings")
      .select("*")
      .eq("user_id", actor.userId)
      .eq("for_date", forDate)
      .maybeSingle();
    if (!readingRow) {
      return jsonError(404, "not_found", "Generate today's reading first.", reqId);
    }
    const reading = readingFromRow(readingRow as Record<string, unknown>);
    facts = buildDailyNarrativeFacts({
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
  } else {
    // Pro tier: the week-ahead narrative rides the week_ahead_full gate.
    if (!allows(entitlements, "week_ahead_full")) {
      return jsonError(403, "forbidden", "Not in your plan.", reqId);
    }
    const week = computeWeekAhead(profile);
    facts = buildWeekNarrativeFacts(week);
  }

  if (!facts) {
    // Thin engine facts — refusal path. No model call, nothing cached,
    // a plain null for the UI to render nothing over.
    return jsonOk({ narrative: null, source: "refused" }, reqId);
  }

  const outcome = await getOrGenerateNarrative({
    store: supabaseNarrativeStore(actor.supabase),
    adapter: new MercuryNarrativeAdapter(),
    userId: actor.userId,
    scope: parsed.data.scope,
    forDate,
    facts,
    admitGeneration: () =>
      rateLimit(`narrative:${actor.userId}`, RATE_LIMITS.generate).allowed,
  });

  return jsonOk({ narrative: outcome.narrative, source: outcome.source }, reqId);
}
