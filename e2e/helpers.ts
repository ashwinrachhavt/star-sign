/**
 * Test-only session stub + seeding for the E2E journey (W4).
 *
 * Owner decision: no live Clerk keys today — the journey runs without a
 * real Clerk sign-up. The stub is a GoTrue-ISSUED session for a seeded
 * identity (password grant against the local stack), injected at the
 * lightest seam: the @supabase/ssr session cookie. Everything downstream
 * stays real —
 *
 *   - the session token is signed and validated by GoTrue itself (no
 *     hand-made tokens to keep in sync with the stack's secrets),
 *   - the app code runs unmodified (no env flag, no branch in the app),
 *   - PostgREST enforces RLS v3: actor resolution goes through
 *     profiles.clerk_subject = auth.jwt()->>'sub' (migration 0013),
 *   - identity anchoring goes through the production SQL bridge channel
 *     (auth.users row → handle_new_user signup-trigger profile →
 *     clerk_subject mapping), the same shape provisionClerkProfileViaSql
 *     uses for first Clerk sign-ins.
 *
 * The uncovered seam is the Clerk SDK handshake itself (session issuance,
 * Clerk middleware, third-party issuer validation at Supabase) — flagged
 * in the PR.
 */

import { randomUUID } from "node:crypto";
import postgres from "postgres";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost:54321";

/** Database connection for seeding + assertions (service-level, like sql-admin.ts). */
export function databaseUrl(): string {
  return (
    process.env.SUPABASE_DB_URL ??
    process.env.STAR_SIGN_TEST_DATABASE_URL ??
    (process.env.SUPABASE_DB_PASSWORD
      ? `postgres://postgres:${process.env.SUPABASE_DB_PASSWORD}@localhost:54322/postgres`
      : "postgres://postgres:postgres@localhost:54322/postgres")
  );
}

interface GoTrueSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
}

/**
 * The @supabase/ssr session cookie carrying the GoTrue-issued session.
 *
 * supabase-js derives the storage key as `sb-<hostname[0]>-auth-token`
 * ("localhost" for the default local URL), and @supabase/ssr writes
 * sessions with the `base64-` prefix + base64url JSON (its default
 * cookieEncoding). Reading it back requires nothing from the app.
 */
export function stubSessionCookie(session: GoTrueSession): { name: string; value: string } {
  const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  return {
    name: storageKey,
    value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
  };
}

export interface BirthSeed {
  date: string;
  time: string;
  zone: string;
  lat: number;
  lon: number;
  label: string;
}

export interface SeededUser {
  /** auth.users id — also the profile's clerk_subject and the JWT sub. */
  subject: string;
  profileId: string;
  /** GoTrue-issued session for this identity (sub = auth.users id). */
  session: GoTrueSession;
  email: string;
}

/**
 * Seed one identity through the production bridge channel. Retry-safe:
 * a fixed email means each reseed cascades away the previous attempt's
 * rows (auth.users delete → profile → birth profile → connections).
 *
 * The auth.users row is inserted directly (confirmed email, bcrypt
 * password via the stack's pgcrypto, phone left NULL so the unique index
 * tolerates many identities) because the local GoTrue runs with
 * email auto-confirm OFF — an HTTP signup would issue no session. The
 * session itself is still GoTrue-ISSUED, via the password grant, so no
 * token is ever hand-made; the profile the signup trigger creates is
 * then mapped to the identity (the 0009 bridge, auth_provider 'clerk').
 */
export async function seedStubUser(
  sql: postgres.Sql,
  opts: { email: string; password: string; displayName: string; handle?: string; birth?: BirthSeed },
): Promise<SeededUser> {
  const subject = randomUUID();

  await sql.begin(async (tx) => {
    await tx`delete from auth.users where email = ${opts.email}`;

    await tx`
      insert into auth.users (instance_id, id, aud, "role", email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at,
                              confirmation_token, recovery_token, email_change_token_new, email_change_token_current, email_change, phone_change_token)
      values ('00000000-0000-0000-0000-000000000000'::uuid, ${subject}::uuid, 'authenticated', 'authenticated', ${opts.email},
              extensions.crypt(${opts.password}, extensions.gen_salt('bf')), now(),
              ${sql.json({ provider: "clerk", display_name: opts.displayName })},
              now(), now(), '', '', '', '', '', '')`;

    // Map the GoTrue identity onto the app's actor anchor (0009 bridge):
    // profiles.clerk_subject = the auth.users id the JWT sub carries.
    const anchored = await tx`
      update public.profiles
      set clerk_subject = ${subject}, auth_provider = 'clerk', display_name = ${opts.displayName}
      where id = ${subject}::uuid
      returning id`;
    if (anchored.length === 0) {
      // Silent zero-row updates here look like "handle not found" four
      // steps later — fail at the cause instead.
      throw new Error(
        `seedStubUser(${opts.email}): signup trigger created no profile for auth user ${subject}`,
      );
    }

    if (opts.handle) {
      const tagged = await tx`
        update public.profiles set handle = ${opts.handle} where id = ${subject}::uuid
        returning id`;
      if (tagged.length === 0) {
        throw new Error(
          `seedStubUser(${opts.email}): handle update matched no profile for ${subject}`,
        );
      }
    }

    if (opts.birth) {
      await tx`
        insert into public.birth_profiles
          (user_id, birth_date, birth_time, birth_time_precision, birth_time_zone, birth_lat, birth_lon, birth_place_label)
        values (${subject}::uuid, ${opts.birth.date}, ${opts.birth.time}, 'exact',
                ${opts.birth.zone}, ${opts.birth.lat}, ${opts.birth.lon}, ${opts.birth.label})`;
    }
  });

  const grant = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: process.env.SUPABASE_ANON_KEY ?? "" },
    body: JSON.stringify({ email: opts.email, password: opts.password }),
  });
  if (!grant.ok) {
    throw new Error(
      `password grant failed for ${opts.email}: ${grant.status} ${await grant.text()}`,
    );
  }
  const session = (await grant.json()) as GoTrueSession;

  return { subject, profileId: subject, session, email: opts.email };
}
