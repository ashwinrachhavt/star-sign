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

  // NOTE (ASH-258 fix): the previous pre-check read profiles through the
  // actor's RLS-bound client, whose SELECT policy is `auth.uid() = id` —
  // it could only ever see the actor's own row, so every legitimate
  // request 404'd. Existence is now enforced by the connections FK:
  // unknown addressee → 23503 → 404 (the "never confirm which ids exist"
  // contract holds — unknown ids 404 either way, existing ones are only
  // revealed to the person who already knows them).

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
    // FK violation: addressee does not exist → hidden (404), never 403.
    if (error.code === "23503") {
      return jsonError(404, "not_found", "Resource not found.", reqId);
    }
    return jsonError(500, "internal_error", "Could not create connection.", reqId);
  }

  return jsonCreated(toView(inserted), reqId, `/api/connections/${inserted.id}`);
}
