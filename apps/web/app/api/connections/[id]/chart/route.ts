/**
 * GET /api/connections/{id}/chart — the partner chart projection
 * (ASH-257 / 5.2). Serves only what the visibility matrix permits for
 * the current state; anything else is the empty projection. Cross-user
 * connection ids → 404 (hidden).
 */
import { computeNatalChart } from "@star-sign/core";
import { jsonError, jsonOk, rateLimit, rateLimitResponse, RATE_LIMITS, requestId, requireActor } from "../../../_lib/api";
import { projectPartnerChart, type ConnectionState } from "../../../../../server/connections/visibility";
import { rowToBirthProfile } from "@/lib/readings";
import { adminClient } from "@/lib/auth/admin";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const reqId = requestId();
  const { id } = await ctx.params;

  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;
  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  // The connection row: participants only (RLS also enforces; the explicit
  // check keeps the 404 contract for foreign ids).
  const { data: connection } = await actor.supabase
    .from("connections")
    .select("id, requester_id, addressee_id, state, share_scope")
    .eq("id", id)
    .maybeSingle();

  if (!connection || (connection.requester_id !== actor.userId && connection.addressee_id !== actor.userId)) {
    return jsonError(404, "not_found", "Resource not found.", reqId);
  }

  // The *other* participant's chart.
  const partnerId =
    connection.requester_id === actor.userId ? connection.addressee_id : connection.requester_id;

  const state = connection.state as ConnectionState;
  const shareScope = connection.share_scope as "none" | "chart_placements";

  // Partner identity + birth row are read via the service-role client:
  // the actor's RLS-bound client can only ever see their own rows
  // (profiles/birth_profiles policies are `auth.uid() = owner`), so the
  // partner lookups would always return null (ASH-258 fix — same class
  // as the request-route addressee bug). The SECURITY boundary remains
  // the projection allowlist below: the service role lifts the storage
  // read; projectPartnerChart still decides what is served per state.
  const admin = adminClient();

  const { data: partnerProfile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", partnerId)
    .single();

  let chart = null;
  if (state === "accepted" && shareScope === "chart_placements") {
    const { data: partnerBirth } = await admin
      .from("birth_profiles")
      .select("*")
      .eq("user_id", partnerId)
      .maybeSingle();
    if (partnerBirth) {
      // Server-side computation only; raw birth fields never leave.
      chart = computeNatalChart(rowToBirthProfile(partnerBirth));
    }
  }

  const projection = projectPartnerChart(
    state,
    shareScope,
    chart,
    connection.id,
    partnerProfile?.display_name ?? "your partner",
  );

  return jsonOk(projection, reqId);
}
