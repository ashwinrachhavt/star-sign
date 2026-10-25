/**
 * PUT /api/connections/{id}/declination (api.md §7, ASH-256 / 5.1b) —
 * the pending recipient declines. Decline = revoked by addressee; the
 * state machine (migration 0006) enforces the transition, the handler
 * maps violations to 409. Cross-user targets are 404, never 403.
 */
import { uuidSchema } from "@star-sign/core";
import {
  jsonError,
  jsonOk,
  notFoundIfForeign,
  rateLimit,
  rateLimitResponse,
  RATE_LIMITS,
  requestId,
  requireActor,
} from "../../../_lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(_req: Request, ctx: Ctx) {
  const reqId = requestId();
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) {
    return jsonError(400, "validation_failed", "Invalid id.", reqId);
  }

  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;
  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const { data: row } = await actor.supabase
    .from("connections")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const isParticipant =
    row && (row.requester_id === actor.userId || row.addressee_id === actor.userId);
  const forbidden = notFoundIfForeign(isParticipant ? actor.userId : null, actor.userId, reqId);
  if (forbidden) return forbidden;
  if (!row) return jsonError(404, "not_found", "Resource not found.", reqId);

  // Idempotent: already-declined returns the current state.
  if (row.state === "revoked") {
    return jsonOk({ id: row.id, state: row.state }, reqId);
  }
  if (row.state !== "requested") {
    return jsonError(
      409,
      "conflict",
      `Connection is ${row.state}; nothing to decline.`,
      reqId,
    );
  }
  if (actor.userId !== row.addressee_id) {
    return jsonError(409, "conflict", "Only the recipient can decline.", reqId);
  }

  const { error } = await actor.supabase
    .from("connections")
    .update({ state: "revoked", ended_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return jsonError(409, "conflict", "Decline failed; state may have changed.", reqId);
  }
  return jsonOk({ id, state: "revoked" }, reqId);
}
