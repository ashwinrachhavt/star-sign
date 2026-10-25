/**
 * POST /api/onboarding — record who is onboarding and everything they
 * enter as they move through the flow (owner request). One row per
 * account, upserted at each step; completed_at set when the birth
 * profile is saved. Identity: the Clerk subject is recorded when Clerk
 * auth is active; email/display name come from the session when
 * available.
 */
import { jsonError, jsonOk, parseBody, rateLimit, rateLimitResponse, RATE_LIMITS, requestId, requireActor } from "../_lib/api";
import { z } from "zod";

const onboardingSchema = z
  .object({
    displayName: z.string().max(120).nullish(),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    birthTime: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
    birthTimePrecision: z.enum(["exact", "approximate", "unknown"]).nullish(),
    birthTimeZone: z.string().max(64).nullish(),
    birthPlaceLabel: z.string().max(200).nullish(),
    birthLat: z.number().min(-90).max(90).nullish(),
    birthLon: z.number().min(-180).max(180).nullish(),
    completed: z.boolean().nullish(),
  })
  .strict();

export async function POST(req: Request) {
  const reqId = requestId();

  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const parsed = await parseBody(req, onboardingSchema, reqId);
  if (!parsed.ok) return parsed.response;

  const d = parsed.data;
  const { error } = await actor.supabase.from("onboarding_profiles").upsert(
    {
      user_id: actor.userId,
      clerk_subject: actor.clerkSubject,
      auth_provider: actor.clerkSubject ? "clerk" : "supabase",
      ...(d.displayName !== undefined && { display_name: d.displayName }),
      ...(d.birthDate !== undefined && { birth_date: d.birthDate }),
      ...(d.birthTime !== undefined && { birth_time: d.birthTime }),
      ...(d.birthTimePrecision !== undefined && {
        birth_time_precision: d.birthTimePrecision,
      }),
      ...(d.birthTimeZone !== undefined && { birth_time_zone: d.birthTimeZone }),
      ...(d.birthPlaceLabel !== undefined && { birth_place_label: d.birthPlaceLabel }),
      ...(d.birthLat !== undefined && { birth_lat: d.birthLat }),
      ...(d.birthLon !== undefined && { birth_lon: d.birthLon }),
      ...(d.completed && { completed_at: new Date().toISOString() }),
    },
    { onConflict: "user_id" },
  );

  if (error) return jsonError(500, "internal_error", "Could not save onboarding state.", reqId);
  return jsonOk({ saved: true }, reqId);
}
