/**
 * Test-only session stub + seeding for the E2E journey (W4).
 *
 * Owner decision: no live Clerk keys today — the journey runs without a
 * real Clerk sign-up. The stub is a synthetic dev JWT whose `sub` matches
 * the seeded profile's `clerk_subject`, injected at the lightest seam: the
 * @supabase/ssr session cookie. Everything downstream stays real —
 *
 *   - GoTrue validates the JWT signature against the local stack's secret
 *     (an unsigned token never resolves a session),
 *   - the app code runs unmodified (no env flag, no branch in the app),
 *   - PostgREST enforces RLS v3: actor resolution goes through
 *     profiles.clerk_subject = auth.jwt()->>'sub' (migration 0013),
 *   - identities are seeded through the production SQL bridge channel
 *     (auth.users anchor → handle_new_user signup-trigger profile →
 *     clerk_subject mapping), the same path provisionClerkProfileViaSql
 *     uses for first Clerk sign-ins.
 *
 * The uncovered seam is the Clerk SDK handshake itself (session issuance,
 * Clerk middleware, third-party issuer validation at Supabase) — flagged
 * in the PR.
 */

import { createHmac, randomUUID } from "node:crypto";
import postgres from "postgres";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost:54321";

const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ??
  "super-secret-jwt-token-with-at-least-32-characters-long";

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

/** Sign the synthetic dev JWT (HS256, signed with the local stack's secret). */
function signDevJwt(payload: Record<string, unknown>): string {
  const encode = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const body = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}`;
  const sig = createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/**
 * The @supabase/ssr session cookie carrying the synthetic token.
 *
 * supabase-js derives the storage key as `sb-<hostname[0]>-auth-token`
 * ("localhost" for the default local URL), and @supabase/ssr writes
 * sessions with the `base64-` prefix + base64url JSON (its default
 * cookieEncoding). Reading it back requires nothing from the app.
 */
export function stubSessionCookie(token: string): { name: string; value: string } {
  const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  const session = {
    access_token: token,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "e2e-stub-refresh",
  };
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
  /** Synthetic dev JWT for this identity (sub = clerk_subject). */
  token: string;
  email: string;
}

/**
 * Seed one identity through the production bridge channel. Retry-safe:
 * a fixed email means each reseed cascades away the previous attempt's
 * rows (auth.users delete → profile → birth profile → connections).
 */
export async function seedStubUser(
  sql: postgres.Sql,
  opts: { email: string; displayName: string; handle?: string; birth?: BirthSeed },
): Promise<SeededUser> {
  // A UUID-shaped clerk_subject: the synthetic identity is a text match
  // for profiles.clerk_subject (0013's resolution needs no UUID, but
  // auth.users.id anchors it and GoTrue must resolve the JWT sub).
  const subject = randomUUID();

  await sql.begin(async (tx) => {
    await tx`delete from auth.users where email = ${opts.email}`;

    const [anchor] = await tx`
      insert into auth.users (id, aud, "role", email, raw_user_meta_data, created_at, updated_at)
      values (${subject}::uuid, 'authenticated', 'authenticated', ${opts.email},
              ${JSON.stringify({ provider: "clerk", display_name: opts.displayName })}::jsonb,
              now(), now())
      returning id`;

    // The handle_new_user signup trigger created the profile for the
    // anchor; map the subject (the 0009 bridge, auth_provider 'clerk').
    await tx`
      update public.profiles
      set clerk_subject = ${subject}, auth_provider = 'clerk', display_name = ${opts.displayName}
      where id = ${anchor.id}`;

    if (opts.handle) {
      await tx`update public.profiles set handle = ${opts.handle} where id = ${anchor.id}`;
    }

    if (opts.birth) {
      await tx`
        insert into public.birth_profiles
          (user_id, birth_date, birth_time, birth_time_precision, birth_time_zone, birth_lat, birth_lon, birth_place_label)
        values (${anchor.id}::uuid, ${opts.birth.date}, ${opts.birth.time}, 'exact',
                ${opts.birth.zone}, ${opts.birth.lat}, ${opts.birth.lon}, ${opts.birth.label})`;
    }
  });

  const now = Math.floor(Date.now() / 1000);
  const token = signDevJwt({
    sub: subject,
    role: "authenticated",
    aud: "authenticated",
    iat: now,
    exp: now + 3600,
  });

  return { subject, profileId: subject, token, email: opts.email };
}
