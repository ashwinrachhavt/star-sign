/**
 * Clerk ↔ profile identity bridge (ASH-231 / 0.1b; RLS v3 W1).
 *
 * Clerk issues and revokes sessions; Supabase stays the data layer with
 * RLS resolving ownership through profiles.clerk_subject (migration
 * 0013). The Supabase client carries the Clerk session token via the
 * accessToken callback (native third-party integration), so
 * auth.jwt()->>'sub' IS the Clerk subject — no JWT template and no
 * per-user token minting. (Templates are static claims and cannot
 * perform a per-user DB lookup, which supersedes the 0009-era plan to
 * carry the profile UUID in sub.)
 *
 *   1. Clerk session → subject (text, e.g. user_2abc...)
 *   2. profiles.clerk_subject → profile UUID (unique, migration 0009)
 *   3. requireActor returns the profile UUID; RLS v3 policies resolve
 *      the actor from the token's subject directly.
 *
 * Local/dev fallback without Clerk keys: the pre-existing Supabase
 * session path (token sub = profile UUID) — local Supabase-stack flows
 * (tests, e2e) are unaffected.
 *
 * SECURITY: never trust a client-supplied user id; the subject always
 * comes from the verified Clerk session server-side.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/auth/admin";
import { provisionClerkProfileViaSql } from "@/lib/auth/sql-admin";
import { clerkConfigured } from "@/lib/auth/config";

export { clerkConfigured };

export interface Actor {
  /** Profile UUID — the value every RLS v3 policy resolves through
   *  profiles.clerk_subject. */
  userId: string;
  /** Clerk subject (text). Null when the profile predates Clerk. */
  clerkSubject: string | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Resolves the current Clerk session to a profile row, provisioning one
 * on first sign-in. Returns null when unauthenticated.
 */
export async function resolveActor(): Promise<Actor | null> {
  if (!clerkConfigured()) {
    // Fallback: pre-existing Supabase session path (password users,
    // tests, e2e). Behavior identical to before ASH-231.
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return { userId: data.user.id, clerkSubject: null, supabase };
  }

  const clerk = await currentUser();
  if (!clerk) return null;

  const supabase = await createClient();
  const subject = clerk.id;

  // Bridge: subject → profile UUID (unique column, migration 0009).
  // service-role path is required to read the mapping row without a
  // Supabase JWT (the user is Clerk-authenticated, not yet bridged).
  const admin = adminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id, clerk_subject")
    .eq("clerk_subject", subject)
    .maybeSingle();

  if (existing) {
    return { userId: existing.id, clerkSubject: subject, supabase };
  }

  // First Clerk sign-in: provision the profile through the SQL identity
  // channel (the same one account deletion uses). Third-party auth never
  // creates an auth.users row for a Clerk identity, and profiles.id FKs
  // auth.users(id) — PostgREST alone cannot anchor it. The SQL path
  // anchors the identity row (reusing an existing email's row — the
  // documented email-link import), lets the signup trigger create the
  // profile, and maps the subject with auth_provider 'clerk'.
  const email = clerk.primaryEmailAddress?.emailAddress ?? null;
  const provisioned = await provisionClerkProfileViaSql(subject, email);
  if (!provisioned.ok) return null;

  return { userId: provisioned.profileId, clerkSubject: subject, supabase };
}

/** Read the Clerk session token's subject without full user fetch. */
export async function currentSubject(): Promise<string | null> {
  if (!clerkConfigured()) return null;
  const { userId } = await auth();
  return userId ?? null;
}

/**
 * Signs the current session out on whichever issuer issued it. With
 * Clerk: server-side session end (revokes the Clerk session token —
 * "sign out" on this device). Without: the Supabase path.
 */
export async function signOutCurrent(): Promise<void> {
  if (clerkConfigured()) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const { sessionId } = await auth();
      if (sessionId) {
        await (await clerkClient()).sessions.revokeSession(sessionId);
      }
    } catch {
      // Fall through to the Supabase sign-out: harmless when Clerk
      // already ended the session.
    }
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
}
