/**
 * GET/POST /api/people, DELETE /api/people/{id} (api.md). People are
 * owner-scoped; a cross-user DELETE target returns 404 (hidden), never 403.
 */
import { personInputSchema, uuidSchema } from "@star-sign/core";
import {
  jsonError,
  jsonOk,
  jsonCreated,
  notFoundIfForeign,
  parseBody,
  rateLimit,
  rateLimitResponse,
  RATE_LIMITS,
  requestId,
  requireActor,
} from "../_lib/api";
import { z } from "zod";

export async function GET() {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const { data, error } = await actor.supabase
    .from("people")
    .select("*")
    .eq("owner_id", actor.userId)
    .order("created_at", { ascending: true });
  if (error) return jsonError(500, "internal_error", "Read failed.", reqId);
  return jsonOk({ data }, reqId);
}

export async function POST(req: Request) {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const parsed = await parseBody(req, personInputSchema, reqId);
  if (!parsed.ok) return parsed.response;

  const { data, error } = await actor.supabase
    .from("people")
    .insert({
      owner_id: actor.userId,
      display_name: parsed.data.displayName,
      birth_date: parsed.data.birthDate ?? null,
      birth_time:
        parsed.data.birthTimePrecision === "unknown"
          ? null
          : parsed.data.birthTime ?? null,
      birth_time_precision: parsed.data.birthTimePrecision,
      birth_time_zone: parsed.data.birthTimeZone ?? null,
      birth_lat: parsed.data.birthLat ?? null,
      birth_lon: parsed.data.birthLon ?? null,
      relation: parsed.data.relation,
    })
    .select()
    .single();

  if (error) return jsonError(500, "internal_error", "Create failed.", reqId);
  return jsonCreated(data, reqId, `/api/people/${data.id}`);
}

const deleteParams = z.object({ id: uuidSchema });

export async function DELETE(req: Request) {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const url = new URL(req.url);
  const params = deleteParams.safeParse({ id: url.searchParams.get("id") });
  if (!params.success) {
    return jsonError(400, "validation_failed", "Invalid or missing id.", reqId);
  }

  // Ownership check first: foreign or absent rows both 404.
  const { data: existing } = await actor.supabase
    .from("people")
    .select("owner_id")
    .eq("id", params.data.id)
    .maybeSingle();
  const forbidden = notFoundIfForeign(existing?.owner_id, actor.userId, reqId);
  if (forbidden) return forbidden;

  const { error } = await actor.supabase
    .from("people")
    .delete()
    .eq("id", params.data.id)
    .eq("owner_id", actor.userId);
  if (error) return jsonError(500, "internal_error", "Delete failed.", reqId);
  return new Response(null, { status: 204 });
}
