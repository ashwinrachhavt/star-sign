/**
 * GET/POST /api/reflections (api.md §6): paginated owned notes; create with
 * optional owned reading reference.
 */
import { reflectionInputSchema } from "@star-sign/core";
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
import { z } from "zod";

const listParams = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(200).optional(),
});

export async function GET(req: Request) {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const url = new URL(req.url);
  const params = listParams.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!params.success) {
    return jsonError(400, "validation_failed", "Invalid pagination.", reqId);
  }

  let query = actor.supabase
    .from("reflections")
    .select("*")
    .eq("user_id", actor.userId)
    .order("created_at", { ascending: false })
    .limit(params.data.limit + 1);
  if (params.data.cursor) {
    // Opaque cursor: created_at ISO string of the last row.
    query = query.lt("created_at", params.data.cursor);
  }
  const { data, error } = await query;
  if (error) return jsonError(500, "internal_error", "Read failed.", reqId);

  const rows = data ?? [];
  const hasMore = rows.length > params.data.limit;
  return jsonOk(
    {
      data: rows.slice(0, params.data.limit),
      pagination: {
        nextCursor: hasMore ? rows[params.data.limit - 1].created_at : null,
      },
    },
    reqId,
  );
}

export async function POST(req: Request) {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const parsed = await parseBody(req, reflectionInputSchema, reqId);
  if (!parsed.ok) return parsed.response;

  const { data, error } = await actor.supabase
    .from("reflections")
    .insert({
      user_id: actor.userId,
      for_date: parsed.data.forDate,
      body: parsed.data.body,
    })
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return jsonError(409, "conflict", "Reflection already exists for this date.", reqId);
    }
    return jsonError(500, "internal_error", "Create failed.", reqId);
  }
  return jsonCreated(data, reqId, `/api/reflections/${data.id}`);
}
