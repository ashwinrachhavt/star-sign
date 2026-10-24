/**
 * GET/PUT /api/me/birth-profile (api.md §6). PUT validates a complete
 * replacement via the shared schema. v1 persistence keeps a single row per
 * user; the schema is the boundary contract for when immutable revisions
 * land (data-model.md).
 */
import { birthProfileInputSchema } from "@star-sign/core";
import {
  jsonError,
  jsonOk,
  parseBody,
  rateLimit,
  rateLimitResponse,
  RATE_LIMITS,
  requestId,
  requireActor,
} from "../../_lib/api";

export async function GET() {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const { data, error } = await actor.supabase
    .from("birth_profiles")
    .select("*")
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (error) return jsonError(500, "internal_error", "Read failed.", reqId);
  return jsonOk({ data }, reqId);
}

export async function PUT(req: Request) {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const parsed = await parseBody(req, birthProfileInputSchema, reqId);
  if (!parsed.ok) return parsed.response;

  const { error } = await actor.supabase.from("birth_profiles").upsert({
    user_id: actor.userId,
    birth_date: parsed.data.birthDate,
    birth_time:
      parsed.data.birthTimePrecision === "unknown"
        ? null
        : parsed.data.birthTime ?? null,
    birth_time_precision: parsed.data.birthTimePrecision,
    birth_time_zone: parsed.data.birthTimeZone,
    iana_timezone: parsed.data.ianaTimeZone ?? parsed.data.birthTimeZone,
    birth_lat: parsed.data.birthPlace.lat,
    birth_lon: parsed.data.birthPlace.lon,
    birth_place_label: parsed.data.birthPlace.label ?? null,
  });

  if (error) return jsonError(500, "internal_error", "Save failed.", reqId);
  return jsonOk({ saved: true }, reqId);
}
