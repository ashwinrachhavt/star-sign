/**
 * PUT /api/connections/{id}/acceptance (api.md §7, ASH-258 fix).
 *
 * The 5.1 route exposed this as PUT /api/connections/{id} — the
 * api.md-declared path had no route file, so acceptance 404'd from any
 * client using the documented URL. This handler mirrors the [id] route's
 * PUT semantics: recipient-only, idempotent repetition returns current
 * state, wrong state → 409. Cross-user ids → 404 (hidden).
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
  const forbidden = notFoundIfForeign(
    isParticipant ? actor.userId : null,
    actor.userId,
    reqId,
  );
  if (forbidden) return forbidden;
  if (!row) return jsonError(404, "not_found", "Resource not found.", reqId);

  if (row.state === "accepted") {
    return jsonOk(
      { id: row.id, state: row.state },
      reqId,
    );
  }
  if (row.state !== "requested") {
    return jsonError(
      409,
      "conflict",
      `Connection is ${row.state}; nothing to accept.`,
      reqId,
    );
  }
  if (actor.userId !== row.addressee_id) {
    return jsonError(409, "conflict", "Only the recipient can accept.", reqId);
  }

  const { data: updated, error } = await actor.supabase
    .from("connections")
    .update({ state: "accepted", responded_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return jsonError(409, "conflict", "Accept failed; state may have changed.", reqId);
  }
  return jsonOk({ id: updated.id, state: updated.state }, reqId);
}
