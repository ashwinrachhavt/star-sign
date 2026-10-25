/**
 * Clerk ↔ profile identity bridge (ASH-231 / 0.1b).
 *
 * Clerk issues and revokes sessions; Supabase stays the data layer with
 * its existing auth.uid()-based RLS. The bridge maps a Clerk subject to
 * the local profile UUID every RLS policy already expects:
 *
 *   1. Clerk session → subject (text, e.g. user_2abc...)
 *   2. profiles.clerk_subject → profile UUID (unique, migration 0007)
 *   3. requireActor returns the profile UUID; Supabase queries run with
 *      the profile's anon-key session — RLS keeps using auth.uid().
 *
 * For RLS to enforce per-actor policies, the Supabase request must carry
 * a JWT whose sub is the profile UUID. Two paths:
 *   - Production: Supabase third-party auth with Clerk as JWT issuer +
 *     a custom JWT template claim holding the mapped profile UUID
 *     (dashboard config — see AUTH_SETUP.md; documented, not code).
 *   - Local/dev fallback without that config: the bridge provisions an
 *     unsigned dev context only when CLERK is not configured at all, so
 *     local Supabase-stack flows (tests, e2e) are unaffected.
 *
 * SECURITY: never trust a client-supplied user id; the subject always
 * comes from the verified Clerk session server-side.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/auth/admin";

export interface Actor {
  /** Profile UUID — the value every RLS policy compares auth.uid() against. */
  userId: string;
  /** Clerk subject (text). Null when the profile predates Clerk. */
  clerkSubject: string | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * True when Clerk env is present. Without it (local Supabase-stack runs,
 * CI), auth flows fall back to the pre-existing Supabase session path —
 * the migration never locks anyone out (ticket criterion 2).
 */
export function clerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
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

  // Bridge: subject → profile UUID (unique column, migration 0007).
  // service-role path is required to read/write the mapping row without
  // a Supabase JWT (the user is Clerk-authenticated, not yet bridged).
  const admin = adminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id, clerk_subject")
    .eq("clerk_subject", subject)
    .maybeSingle();

  if (existing) {
    return { userId: existing.id, clerkSubject: subject, supabase };
  }

  // First Clerk sign-in: provision the profile. Email is the natural
  // display fallback; the profile row is tiny by design (ASH-231 ruled
  // no separate users table — profiles.id stays the FK target).
  const email = clerk.primaryEmailAddress?.emailAddress ?? null;
  const { data: created, error } = await admin
    .from("profiles")
    .insert({ clerk_subject: subject, display_name: email ?? "friend" })
    .select("id, clerk_subject")
    .single();
  if (error || !created) return null;

  return { userId: created.id, clerkSubject: subject, supabase };
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
