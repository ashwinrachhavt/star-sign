/**
 * GET /api/friend-updates (W2, SHAPE F).
 *
 * One update per accepted connection whose OTHER party granted daily
 * updates: that person's daily theme, derived on read from their chart
 * basis + today's transits. Derived — nothing is persisted; the grant
 * and the connection state are rechecked on every request, so a toggle
 * or revocation lands immediately. Cross-user isolation rides RLS v3
 * (the actor's client can only read their own connection rows).
 */
import { friendUpdatesViewSchema } from "@star-sign/core";
import {
  jsonError,
  jsonOk,
  rateLimit,
  rateLimitResponse,
  RATE_LIMITS,
  requestId,
  requireActor,
} from "../_lib/api";
import { adminClient } from "@/lib/auth/admin";
import { deriveFriendUpdate, todayForZone } from "@/lib/friend-updates";
import type { BirthProfileRow } from "@/lib/readings";

export async function GET() {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  // The actor's own connection rows only (RLS v3 also enforces).
  const { data: connections, error } = await actor.supabase
    .from("connections")
    .select(
      "id, requester_id, addressee_id, state, daily_updates_requester, daily_updates_addressee",
    )
    .eq("state", "accepted")
    .or(`requester_id.eq.${actor.userId},addressee_id.eq.${actor.userId}`);
  if (error) return jsonError(500, "internal_error", "Read failed.", reqId);

  // Keep only connections the OTHER party granted their updates to the
  // actor (their grant column, read from the actor's side of the row).
  const granted = (connections ?? []).filter((c) =>
    c.requester_id === actor.userId
      ? c.daily_updates_addressee
      : c.daily_updates_requester,
  );

  const admin = adminClient();
  const updates = [];
  for (const connection of granted) {
    const partnerId =
      connection.requester_id === actor.userId
        ? connection.addressee_id
        : connection.requester_id;

    // Identity + birth row via service role: the actor's RLS-bound client
    // can only see their own rows (same boundary as the partner-chart
    // route — the projection allowlist below remains the security edge).
    const { data: profile } = await admin
      .from("profiles")
      .select("display_name, handle")
      .eq("id", partnerId)
      .maybeSingle();

    const { data: birth } = await admin
      .from("birth_profiles")
      .select("*")
      .eq("user_id", partnerId)
      .maybeSingle();

    // No onboarded chart basis → no theme to share yet; omitted honestly
    // rather than stubbed with generic copy.
    if (!profile || !birth) continue;

    updates.push(
      deriveFriendUpdate({
        connectionId: connection.id,
        displayName: profile.display_name,
        handle: profile.handle ?? null,
        birthRow: birth as BirthProfileRow,
        // Their today: the date in THEIR birth zone — their own reading basis.
        forDate: todayForZone((birth as BirthProfileRow).birth_time_zone),
      }),
    );
  }

  return jsonOk(friendUpdatesViewSchema.parse({ updates }), reqId);
}
