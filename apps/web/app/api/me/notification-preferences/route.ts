/**
 * GET/PUT /api/me/notification-preferences (ASH-263 / 7.1).
 * Defaults are quiet; the user owns every field (criterion 4).
 */
import { z } from "zod";
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

const prefsSchema = z
  .object({
    optFullMoon: z.boolean().optional(),
    optRetrograde: z.boolean().optional(),
    optWeeklyDigest: z.boolean().optional(),
    quietStartHour: z.number().int().min(0).max(23).optional(),
    quietEndHour: z.number().int().min(0).max(23).optional(),
    ianaTimezone: z.string().min(1).max(64).optional(),
    pushToken: z.string().max(400).nullish(),
  })
  .strict();

export async function GET() {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  // Defaults-quiet: create the row on first read so the UI shows real state.
  const { data, error } = await actor.supabase
    .from("notification_preferences")
    .upsert({ user_id: actor.userId }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) return jsonError(500, "internal_error", "Read failed.", reqId);
  return jsonOk(data, reqId);
}

export async function PUT(req: Request) {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const parsed = await parseBody(req, prefsSchema, reqId);
  if (!parsed.ok) return parsed.response;

  const { data, error } = await actor.supabase
    .from("notification_preferences")
    .upsert(
      {
        user_id: actor.userId,
        ...(parsed.data.optFullMoon !== undefined && { opt_full_moon: parsed.data.optFullMoon }),
        ...(parsed.data.optRetrograde !== undefined && { opt_retrograde: parsed.data.optRetrograde }),
        ...(parsed.data.optWeeklyDigest !== undefined && { opt_weekly_digest: parsed.data.optWeeklyDigest }),
        ...(parsed.data.quietStartHour !== undefined && { quiet_start_hour: parsed.data.quietStartHour }),
        ...(parsed.data.quietEndHour !== undefined && { quiet_end_hour: parsed.data.quietEndHour }),
        ...(parsed.data.ianaTimezone !== undefined && { iana_timezone: parsed.data.ianaTimezone }),
        ...(parsed.data.pushToken !== undefined && { push_token: parsed.data.pushToken }),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();

  if (error) return jsonError(500, "internal_error", "Save failed.", reqId);
  return jsonOk(data, reqId);
}
