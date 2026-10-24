/**
 * API helpers (ASH-233 / 0.3a, 0.3d) — materializes .agents/api.md.
 *
 * Error envelope, request ID, requireActor guard, rate limiting. Route
 * handlers stay skinny: parse → guard → operation → serialize.
 */
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

export interface ApiMeta {
  requestId: string;
}

export function jsonOk<T>(data: T, requestId: string, init?: ResponseInit) {
  return NextResponse.json(
    { data, meta: { requestId } satisfies ApiMeta },
    { status: 200, ...init, headers: { "Cache-Control": "private, no-store", ...(init?.headers ?? {}) } },
  );
}

export function jsonCreated<T>(data: T, requestId: string, location?: string) {
  return NextResponse.json(
    { data, meta: { requestId } satisfies ApiMeta },
    {
      status: 201,
      headers: {
        "Cache-Control": "private, no-store",
        ...(location ? { Location: location } : {}),
      },
    },
  );
}

export type ApiErrorCode =
  | "validation_failed"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal_error";

export function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string,
  requestId: string,
  details?: Array<{ path: string; code: string }>,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    {
      error: { code, message, ...(details ? { details } : {}) },
      meta: { requestId } satisfies ApiMeta,
    },
    { status, headers: { "Cache-Control": "private, no-store", ...headers } },
  );
}

/** New request ID per handler invocation (correlates logs + responses). */
export function requestId(): string {
  return crypto.randomUUID();
}

/** Parses a JSON body against a schema; returns a 400 envelope on failure. */
export async function parseBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
  reqId: string,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: jsonError(400, "validation_failed", "Malformed JSON.", reqId),
    };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: jsonError(
        400,
        "validation_failed",
        "Check the highlighted fields.",
        reqId,
        result.error.issues.map((i) => ({
          path: i.path.join("."),
          code: i.code,
        })),
      ),
    };
  }
  return { ok: true, data: result.data };
}

/**
 * requireActor: verifies the Supabase session (which in turn verifies the
 * identity token) and returns the actor's id + scoped client. 401 when
 * missing/invalid. Never trusts a client-supplied user id.
 */
export async function requireActor(
  reqId: string,
): Promise<
  { ok: true; userId: string; supabase: Awaited<ReturnType<typeof createClient>> } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return {
      ok: false,
      response: jsonError(401, "unauthenticated", "Sign in required.", reqId),
    };
  }
  return { ok: true, userId: data.user.id, supabase };
}

/**
 * Cross-user resources return 404 (hidden), not 403 (forbidden) — the
 * existence of another user's resource is never confirmed.
 */
export function notFoundIfForeign(
  ownedBy: string | null | undefined,
  actorId: string,
  reqId: string,
): NextResponse | null {
  if (ownedBy === actorId) return null;
  return jsonError(404, "not_found", "Resource not found.", reqId);
}

// ---------------------------------------------------------------------------
// Rate limiting (0.3d)
//
// Mechanism choice (documented per api.md §9): in-process token bucket keyed
// by actor. Vercel's serverless model means this is per-instance and best-
// effort until a shared store lands — documented fail-open posture, chosen
// because generation is also DB-constrained by the (user_id, for_date)
// unique rule, so a miss degrades to the idempotency guard, not abuse.
// ---------------------------------------------------------------------------

const buckets = new Map<string, { tokens: number; last: number }>();

export interface RateLimitRule {
  /** Requests allowed per window */
  limit: number;
  /** Window length in ms */
  windowMs: number;
}

export const RATE_LIMITS = {
  /** Generation endpoints: 10/min/user (api.md default) */
  generate: { limit: 10, windowMs: 60_000 } satisfies RateLimitRule,
  /** Ordinary API access: 60/min/user */
  general: { limit: 60, windowMs: 60_000 } satisfies RateLimitRule,
};

export function rateLimit(
  key: string,
  rule: RateLimitRule,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: rule.limit, last: now };
  const refill = ((now - bucket.last) / rule.windowMs) * rule.limit;
  bucket.tokens = Math.min(rule.limit, bucket.tokens + refill);
  bucket.last = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    const retryAfterSeconds = Math.ceil(
      ((1 - bucket.tokens) / rule.limit) * (rule.windowMs / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function rateLimitResponse(retryAfterSeconds: number, reqId: string) {
  return jsonError(
    429,
    "rate_limited",
    "Too many requests. Try again shortly.",
    reqId,
    undefined,
    { "Retry-After": String(Math.max(1, retryAfterSeconds)) },
  );
}
