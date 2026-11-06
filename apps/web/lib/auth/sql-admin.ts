/**
 * SQL-level identity administration (ASH-231 / 0.1c; RLS v3 W1).
 *
 * PostgREST cannot reach the auth schema, and the app has two identity
 * moments that need it:
 *
 *   - Deletion (ASH-231 / 0.1c): `delete from auth.users` — the FK
 *     cascades then wipe profiles and every owned table.
 *   - Provisioning (RLS v3 W1): Clerk identities have NO auth.users row
 *     (third-party auth trusts the JWT at the API layer and never
 *     imports the user — Supabase docs), while profiles.id FKs
 *     auth.users(id). The anchor row must be created before a profile
 *     can exist for a Clerk user.
 *
 * Both use the postgres client with the database URL from the
 * environment.
 *
 * SECURITY: server-only, called exclusively by account routes after the
 * actor/subject is resolved from the verified session. Identifiers never
 * come from the client.
 */
import postgres from "postgres";

function databaseUrlFromEnv(): string | null {
  return (
    process.env.SUPABASE_DB_URL ??
    process.env.STAR_SIGN_TEST_DATABASE_URL ??
    (process.env.SUPABASE_DB_PASSWORD
      ? `postgres://postgres:${process.env.SUPABASE_DB_PASSWORD}@localhost:54322/postgres`
      : null)
  );
}

export function deleteAuthUserViaSql(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const url = databaseUrlFromEnv();

  if (!url) {
    return Promise.resolve({
      ok: false,
      error: "no database url configured for identity deletion",
    });
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  return (async () => {
    try {
      await sql`delete from auth.users where id = ${userId}`;
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "delete failed" };
    } finally {
      await sql.end();
    }
  })();
}

export type ProvisionResult =
  | { ok: true; profileId: string }
  | { ok: false; error: string };

/**
 * Provisions the profile for a verified Clerk subject (first sign-in).
 *
 * One transaction: anchor one auth.users row (explicit id — hosted
 * auth.users has no id default), let the signup trigger create the
 * profile row, then map the Clerk subject onto it with auth_provider
 * 'clerk'. The anchor reuses an existing email's identity row via ON
 * CONFLICT — that is the documented email-link import path for legacy
 * Supabase users (AUTH_SETUP §6).
 *
 * Callers re-check by subject first; the subject mapping is the last
 * write, so a retry after a partial failure converges on the anchored
 * row. A NULL email cannot conflict — a retry anchors fresh (an
 * accepted, isolated orphan rather than a lockout).
 */
export function provisionClerkProfileViaSql(
  subject: string,
  email: string | null,
): Promise<ProvisionResult> {
  const url = databaseUrlFromEnv();
  if (!url) {
    return Promise.resolve({
      ok: false,
      error: "no database url configured for identity provisioning",
    });
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  return (async () => {
    try {
      return await sql.begin(async (tx) => {
        // Concurrent-provision re-check: profiles.clerk_subject is the
        // single identity mapping (unique column).
        const existing = await tx`
          select p.id from public.profiles p
          where p.clerk_subject = ${subject}`;
        if (existing.length > 0) {
          return { ok: true as const, profileId: existing[0].id as string };
        }

        const meta = JSON.stringify({
          provider: "clerk",
          display_name: email ?? "friend",
        });
        // GoTrue indexes email with a PARTIAL unique index
        // (users_email_partial_key, where is_sso_user = false), and
        // Postgres only infers an ON CONFLICT arbiter from a full unique
        // constraint. Name the index so the email-link path works.
        // A NULL email cannot conflict, so it takes the plain insert.
        const anchorRows = email
          ? await tx`
              insert into auth.users (id, aud, "role", email, raw_user_meta_data, created_at, updated_at)
              values (gen_random_uuid(), 'authenticated', 'authenticated', ${email}, ${meta}::jsonb, now(), now())
              on conflict (email) where is_sso_user = false do update set updated_at = now()
              returning id`
          : await tx`
              insert into auth.users (id, aud, "role", email, raw_user_meta_data, created_at, updated_at)
              values (gen_random_uuid(), 'authenticated', 'authenticated', ${email}, ${meta}::jsonb, now(), now())
              returning id`;

        // The signup trigger (handle_new_user) created the profile for
        // the anchor within this transaction — map the subject onto it.
        const [profile] = await tx`
          update public.profiles
          set clerk_subject = ${subject}, auth_provider = 'clerk'
          where id = ${anchorRows[0].id}
          returning id`;

        return { ok: true as const, profileId: profile.id as string };
      });
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "provisioning failed",
      };
    } finally {
      await sql.end();
    }
  })();
}
