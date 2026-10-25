/**
 * POST /api/account-export (ASH-231 / 0.1c).
 *
 * Single JSON bundle of every row the actor owns, across all owned
 * tables. Offered on the deletion confirm screen (criterion 5) and as a
 * standalone capability.
 */
import { jsonError, jsonOk, rateLimit, rateLimitResponse, RATE_LIMITS, requestId, requireActor } from "../_lib/api";
import { adminClient } from "@/lib/auth/admin";

const OWNED_TABLES: Array<{ table: string; userColumn: string }> = [
  { table: "birth_profiles", userColumn: "user_id" },
  { table: "daily_readings", userColumn: "user_id" },
  { table: "people", userColumn: "owner_id" },
  { table: "reflections", userColumn: "user_id" },
];

export async function POST() {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const admin = adminClient();

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("*")
    .eq("id", actor.userId)
    .maybeSingle();
  if (profileErr) {
    return jsonError(500, "internal_error", "Export failed.", reqId);
  }

  const bundle: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    profile,
  };

  for (const { table, userColumn } of OWNED_TABLES) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .eq(userColumn, actor.userId);
    if (error) {
      return jsonError(500, "internal_error", `Export failed for ${table}.`, reqId);
    }
    bundle[table] = data;
  }

  // Connections + state log: present once migration 0006 merges; a
  // missing table exports as [] (forward-compatible with the current
  // main, which predates ASH-256).
  bundle.connections =
    (await admin
      .from("connections")
      .select("*")
      .or(`requester_id.eq.${actor.userId},addressee_id.eq.${actor.userId}`)
      .then((r) => (r.error ? [] : r.data))) ?? [];
  bundle.connectionStateLog =
    (await admin
      .from("connection_state_log")
      .select("*")
      .eq("actor_id", actor.userId)
      .then((r) => (r.error ? [] : r.data))) ?? [];

  return jsonOk(bundle, reqId);
}
