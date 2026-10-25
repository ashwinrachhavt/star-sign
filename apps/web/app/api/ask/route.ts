/**
 * POST /api/ask — bounded Q&A over the caller's stored chart + today's
 * reading (ASH-266 / 7.4). Answers cite their facts; refusals for
 * out-of-bounds asks; nothing computed, only retrieved.
 */
import { answerQuestion, computeNatalChart } from "@star-sign/core";
import { rowToBirthProfile } from "@/lib/readings";
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
import { z } from "zod";

const askSchema = z
  .object({ question: z.string().min(3).max(500) })
  .strict();

export async function POST(req: Request) {
  const reqId = requestId();

  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  // Ask is generation-adjacent: generation-tier limit.
  const limit = rateLimit(`generate:${actor.userId}`, RATE_LIMITS.generate);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const parsed = await parseBody(req, askSchema, reqId);
  if (!parsed.ok) return parsed.response;

  const { data: profileRow } = await actor.supabase
    .from("birth_profiles")
    .select("*")
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (!profileRow) {
    return jsonError(409, "conflict", "Complete onboarding first.", reqId);
  }

  const chart = computeNatalChart(rowToBirthProfile(profileRow));

  const { data: profileMeta } = await actor.supabase
    .from("profiles")
    .select("display_name")
    .eq("id", actor.userId)
    .single();

  const forDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: profileRow.iana_timezone ?? profileRow.birth_time_zone,
  }).format(new Date());
  const { data: readingRow } = await actor.supabase
    .from("daily_readings")
    .select("*")
    .eq("user_id", actor.userId)
    .eq("for_date", forDate)
    .maybeSingle();

  const reading = readingRow
    ? {
        id: readingRow.id as string,
        forDate: readingRow.for_date as string,
        headline: readingRow.headline as string,
        explanation: readingRow.explanation as string,
        dos: readingRow.dos as string[],
        donts: readingRow.donts as string[],
        lifeAreas: readingRow.life_areas as never[],
        provenance: readingRow.provenance as never,
        uncertaintyNote: readingRow.uncertainty_note as string,
        ...(readingRow.selected_events ? { selectedEvents: readingRow.selected_events as never } : {}),
      }
    : null;

  const answer = answerQuestion(parsed.data.question, {
    chart,
    reading: reading as never,
    displayName: profileMeta?.display_name ?? "friend",
  });

  return jsonOk(answer, reqId);
}
