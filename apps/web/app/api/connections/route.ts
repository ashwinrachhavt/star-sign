/**
 * GET/POST /api/connections (api.md §7, ASH-256 / 5.1b).
 *
 * GET: the actor's connections (any state) — both directions.
 * POST: request a connection. Cross-user existence is never confirmed
 * (a request targeting an unknown/nonexistent user fails closed with
 * 404 at read time and a FK error surfaces as 409 here).
 */
import { connectionRequestSchema, connectionViewSchema } from "@star-sign/core";
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

function toView(row: Record<string, unknown>) {
  return connectionViewSchema.parse({
    id: row.id,
    requesterId: row.requester_id,
    addresseeId: row.addressee_id,
    state: row.state,
    requestedAt: row.requested_at,
    respondedAt: row.responded_at,
    endedAt: row.ended_at,
  });
}

export async function GET() {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const { data, error } = await actor.supabase
    .from("connections")
    .select("*")
    .or(`requester_id.eq.${actor.userId},addressee_id.eq.${actor.userId}`)
    .order("requested_at", { ascending: false });
  if (error) return jsonError(500, "internal_error", "Read failed.", reqId);

  return jsonOk(data.map(toView), reqId);
}

export async function POST(req: Request) {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const parsed = await parseBody(req, connectionRequestSchema, reqId);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.addresseeId === actor.userId) {
    return jsonError(409, "conflict", "You cannot connect to yourself.", reqId);
  }

  // The addressee must exist. FK violations (unknown user) → 409 with a
  // generic message: never confirm which user ids exist.
  const { data: addressee } = await actor.supabase
    .from("profiles")
    .select("id")
    .eq("id", parsed.data.addresseeId)
    .maybeSingle();
  if (!addressee) {
    return jsonError(404, "not_found", "Resource not found.", reqId);
  }

  const { data: inserted, error } = await actor.supabase
    .from("connections")
    .insert({
      requester_id: actor.userId,
      addressee_id: parsed.data.addresseeId,
      state: "requested",
    })
    .select("*")
    .single();

  if (error) {
    // Unique active-pair violation (a connection already exists in
    // either direction) — explicit conflict per api.md §8.
    if (error.code === "23505") {
      return jsonError(
        409,
        "conflict",
        "An active connection between you already exists.",
        reqId,
      );
    }
    return jsonError(500, "internal_error", "Could not create connection.", reqId);
  }

  return jsonCreated(toView(inserted), reqId, `/api/connections/${inserted.id}`);
}
