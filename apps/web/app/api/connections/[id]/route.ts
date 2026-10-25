/**
 * GET/DELETE /api/connections/{id} + PUT acceptance/declination
 * (api.md §7, ASH-256 / 5.1b).
 *
 * State transitions live in the database trigger (migration 0006); the
 * handler maps violations to 409. Cross-user targets are 404 (hidden),
 * never 403. DELETE revokes/disconnects immediately and unilaterally
 * (criterion 3): requester may withdraw/disconnect, addressee may
 * decline/disconnect.
 */
import { connectionViewSchema, uuidSchema } from "@star-sign/core";
import {
  jsonError,
  jsonOk,
  notFoundIfForeign,
  rateLimit,
  rateLimitResponse,
  RATE_LIMITS,
  requestId,
  requireActor,
} from "../../_lib/api";

type Ctx = { params: Promise<{ id: string }> };

async function loadParticipant(id: string, reqId: string) {
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor;

  const { data } = await actor.supabase
    .from("connections")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // Row exists but the actor is not a participant → hidden (404).
  const isParticipant =
    data && (data.requester_id === actor.userId || data.addressee_id === actor.userId);
  const forbidden = notFoundIfForeign(isParticipant ? actor.userId : null, actor.userId, reqId);
  if (forbidden) return { ok: false as const, response: forbidden };

  return { ok: true as const, supabase: actor.supabase, userId: actor.userId, row: data };
}

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

export async function GET(_req: Request, ctx: Ctx) {
  const reqId = requestId();
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) {
    return jsonError(400, "validation_failed", "Invalid id.", reqId);
  }

  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;
  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const result = await loadParticipant(id, reqId);
  if (!result.ok) return result.response;
  if (!result.row) return jsonError(404, "not_found", "Resource not found.", reqId);
  return jsonOk(toView(result.row), reqId);
}

/** PUT /api/connections/{id}/acceptance — recipient only. */
export async function PUT(req: Request, ctx: Ctx) {
  const reqId = requestId();
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) {
    return jsonError(400, "validation_failed", "Invalid id.", reqId);
  }

  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;
  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const result = await loadParticipant(id, reqId);
  if (!result.ok) return result.response;
  if (!result.row) return jsonError(404, "not_found", "Resource not found.", reqId);

  if (result.row.state === "accepted") {
    // Idempotent repetition returns the current result (api.md §8).
    return jsonOk(toView(result.row), reqId);
  }
  if (result.row.state !== "requested") {
    return jsonError(
      409,
      "conflict",
      `Connection is ${result.row.state}; nothing to accept.`,
      reqId,
    );
  }
  if (result.userId !== result.row.addressee_id) {
    return jsonError(409, "conflict", "Only the recipient can accept.", reqId);
  }

  const { data: updated, error } = await result.supabase
    .from("connections")
    .update({ state: "accepted", responded_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return jsonError(409, "conflict", "Accept failed; state may have changed.", reqId);
  }
  return jsonOk(toView(updated), reqId);
}

/** DELETE /api/connections/{id} — revoke/disconnect, unilateral + immediate. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const reqId = requestId();
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) {
    return jsonError(400, "validation_failed", "Invalid id.", reqId);
  }

  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;
  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const result = await loadParticipant(id, reqId);
  if (!result.ok) return result.response;
  if (!result.row) return jsonError(404, "not_found", "Resource not found.", reqId);

  // Already ended: idempotent 204 (no new effects).
  if (result.row.state === "revoked" || result.row.state === "disconnected") {
    return new Response(null, { status: 204 });
  }

  // Requester ending their own pending request or an accepted connection
  // withdraws/revokes; addressee declining/ending revokes/disconnects.
  const terminal =
    result.row.state === "requested" && result.userId === result.row.addressee_id
      ? "revoked" // decline
      : result.row.state === "accepted"
        ? "disconnected"
        : "revoked"; // withdraw

  const { error } = await result.supabase
    .from("connections")
    .update({ state: terminal, ended_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return jsonError(409, "conflict", "Could not end connection.", reqId);
  }
  return new Response(null, { status: 204 });
}
