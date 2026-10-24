/**
 * POST /api/daily-readings — ensure canonical reading for the account-local
 * date (api.md §6). Create → 201; existing/race winner → 200. GET stays
 * read-only; the UI calls POST after an absent read.
 */
import { getOrCreateDailyReading } from "@/lib/readings";
import {
  jsonCreated,
  jsonError,
  jsonOk,
  parseBody,
  rateLimit,
  rateLimitResponse,
  RATE_LIMITS,
  requestId,
  requireActor,
} from "../_lib/api";
import { dailyReadingRequestSchema } from "@star-sign/core";

export async function POST(req: Request) {
  const reqId = requestId();

  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`generate:${actor.userId}`, RATE_LIMITS.generate);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const parsed = await parseBody(req, dailyReadingRequestSchema, reqId);
  if (!parsed.ok) return parsed.response;

  const { data: profileRow } = await actor.supabase
    .from("birth_profiles")
    .select("birth_time_zone")
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

  const result = await getOrCreateDailyReading(
    actor.supabase,
    actor.userId,
    forDate,
  );
  if ("error" in result) {
    return jsonError(500, "internal_error", "Could not create reading.", reqId);
  }
  return jsonCreated(result, reqId, `/api/daily-readings/${result.id}`);
}

export async function GET() {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const { data: profileRow } = await actor.supabase
    .from("birth_profiles")
    .select("birth_time_zone")
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (!profileRow) {
    return jsonError(404, "not_found", "No birth profile.", reqId);
  }

  const forDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: profileRow.birth_time_zone,
  }).format(new Date());

  const { data, error } = await actor.supabase
    .from("daily_readings")
    .select("*")
    .eq("user_id", actor.userId)
    .eq("for_date", forDate)
    .maybeSingle();

  if (error) {
    return jsonError(500, "internal_error", "Read failed.", reqId);
  }
  return jsonOk({ data }, reqId);
}
