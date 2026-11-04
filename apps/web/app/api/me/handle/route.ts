/**
 * GET/PATCH /api/me/handle (W2).
 *
 * The actor's public handle: auto-generated at profile creation
 * (migration 0014), editable here. PATCH goes through the actor's
 * RLS-bound client — the "own profile" policy (RLS v3) limits the write
 * to the actor's own row, and the 0014 CHECK + unique constraint keep
 * the format and uniqueness at the table. A taken handle → 409.
 */
import { handleSchema } from "@star-sign/core";
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

const handlePatchSchema = z
  .object({
    handle: handleSchema,
  })
  .strict();

export async function GET() {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const { data, error } = await actor.supabase
    .from("profiles")
    .select("handle")
    .eq("id", actor.userId)
    .maybeSingle();
  if (error) return jsonError(500, "internal_error", "Read failed.", reqId);

  return jsonOk({ handle: (data?.handle as string | null) ?? null }, reqId);
}

export async function PATCH(req: Request) {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const parsed = await parseBody(req, handlePatchSchema, reqId);
  if (!parsed.ok) return parsed.response;

  const { data, error } = await actor.supabase
    .from("profiles")
    .update({ handle: parsed.data.handle })
    .eq("id", actor.userId)
    .select("handle")
    .single();

  if (error) {
    // 23505: another profile already holds that handle.
    if ((error as { code?: string }).code === "23505") {
      return jsonError(409, "conflict", "That handle is taken.", reqId);
    }
    // 23514: the format CHECK — the schema already guards this; a miss
    // here means client and database disagree, so say so honestly.
    if ((error as { code?: string }).code === "23514") {
      return jsonError(400, "validation_failed", "That handle isn't allowed.", reqId);
    }
    return jsonError(500, "internal_error", "Could not update handle.", reqId);
  }

  return jsonOk({ handle: data.handle as string }, reqId);
}
