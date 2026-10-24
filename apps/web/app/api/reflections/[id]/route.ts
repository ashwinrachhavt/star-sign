/**
 * GET/PATCH/DELETE /api/reflections/{id} (api.md §6): owned note with
 * cross-user → 404 semantics. DELETE is idempotent (repeated deletion of an
 * owned, already-deleted resource: 204 — no new effects).
 */
import { reflectionPatchSchema, uuidSchema } from "@star-sign/core";
import {
  jsonError,
  jsonOk,
  notFoundIfForeign,
  parseBody,
  rateLimit,
  rateLimitResponse,
  RATE_LIMITS,
  requestId,
  requireActor,
} from "../../_lib/api";

type Ctx = { params: Promise<{ id: string }> };

async function loadOwned(id: string, actorId: string, reqId: string) {
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor;

  const { data } = await actor.supabase
    .from("reflections")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const forbidden = notFoundIfForeign(data?.user_id, actorId, reqId);
  if (forbidden) return { ok: false as const, response: forbidden };
  return { ok: true as const, supabase: actor.supabase, row: data };
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

  const result = await loadOwned(id, actor.userId, reqId);
  if (!result.ok) return result.response;
  if (!result.row) return jsonError(404, "not_found", "Resource not found.", reqId);
  return jsonOk(result.row, reqId);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const reqId = requestId();
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) {
    return jsonError(400, "validation_failed", "Invalid id.", reqId);
  }

  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;
  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const parsed = await parseBody(req, reflectionPatchSchema, reqId);
  if (!parsed.ok) return parsed.response;

  const result = await loadOwned(id, actor.userId, reqId);
  if (!result.ok) return result.response;
  if (!result.row) return jsonError(404, "not_found", "Resource not found.", reqId);

  const { data, error } = await actor.supabase
    .from("reflections")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", actor.userId)
    .select()
    .single();
  if (error) return jsonError(500, "internal_error", "Update failed.", reqId);
  return jsonOk(data, reqId);
}

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

  const result = await loadOwned(id, actor.userId, reqId);
  if (!result.ok) return result.response;
  if (!result.row) {
    // Already deleted (or never existed): idempotent 204.
    return new Response(null, { status: 204 });
  }

  const { error } = await actor.supabase
    .from("reflections")
    .delete()
    .eq("id", id)
    .eq("user_id", actor.userId);
  if (error) return jsonError(500, "internal_error", "Delete failed.", reqId);
  return new Response(null, { status: 204 });
}
