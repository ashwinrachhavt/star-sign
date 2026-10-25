/**
 * POST /api/account-deletion (ASH-231 / 0.1c).
 *
 * Immediate hard delete: the identity row is removed and FK cascades
 * wipe every owned table (auth.users → profiles → birth_profiles,
 * daily_readings, people, reflections, connections, state log). The
 * Clerk user is deleted via the Backend SDK when CLERK_SECRET_KEY is
 * present; without it (local dev) local rows still go and the response
 * carries a note. Login after deletion is a fresh account (AC 4).
 *
 * Clients must call /api/account-export first (the confirm screen offers
 * it); this endpoint does not return data.
 */
import { jsonError, jsonOk, rateLimit, rateLimitResponse, RATE_LIMITS, requestId, requireActor } from "../_lib/api";
import { clerkConfigured, resolveActor } from "@/lib/auth/bridge";
import { deleteAuthUserViaSql } from "@/lib/auth/sql-admin";

export async function POST() {
  const reqId = requestId();
  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  // Capture the Clerk subject before the profile row (which holds the
  // mapping) is cascaded away.
  const current = await resolveActor();
  const subject = current?.clerkSubject ?? null;

  // Hard delete via SQL: PostgREST cannot touch auth.users; the SQL path
  // deletes the identity row and FK cascades handle the rest.
  const result = await deleteAuthUserViaSql(actor.userId);
  if (!result.ok) {
    return jsonError(500, "internal_error", "Deletion failed.", reqId);
  }

  // Delete the Clerk user too (criterion 4: login after deletion is a
  // fresh account). Requires CLERK_SECRET_KEY; skipped in local dev.
  let clerkDeleted = false;
  let clerkNote: string | undefined;
  if (clerkConfigured() && subject) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      await (await clerkClient()).users.deleteUser(subject);
      clerkDeleted = true;
    } catch {
      clerkNote = "Clerk user deletion failed; delete manually in dashboard.";
    }
  } else if (!clerkConfigured()) {
    clerkNote = "Clerk not configured in this environment; local rows deleted.";
  }

  return jsonOk(
    {
      deleted: true,
      profileId: actor.userId,
      clerkDeleted,
      ...(clerkNote ? { note: clerkNote } : {}),
    },
    reqId,
  );
}
