/**
 * RLS test harness (ASH-232 / 0.2e).
 *
 * Runs migrations against a real Postgres and issues queries through
 * per-actor transactions whose role and request.jwt.claim.sub mirror how
 * Supabase evaluates auth.uid() inside RLS policies — the policies under
 * test are the policies that run in production.
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const migrationsDir = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../supabase/migrations",
);

export type TestDb = ReturnType<typeof postgres>;

const MIGRATIONS = [
  "0001_initial_schema.sql",
  "0002_data_model_v2.sql",
  "0003_job_pattern.sql",
  "0004_ruleset_version_bump_v2026_10_2.sql",
  "0005_sky_events.sql",
  "0005_structured_event_persistence.sql",
  "0006_connections.sql",
  "0006_notifications.sql",
  "0007_share_scope.sql",
];

export async function createHarnessDb(): Promise<TestDb> {
  const url =
    process.env.STAR_SIGN_TEST_DATABASE_URL ??
    "postgres://postgres:postgres@localhost:54329/postgres";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await installShims(sql);
  return sql;
}

/**
 * Role + auth shims mirroring the Supabase local stack: auth.uid() reads
 * the JWT sub claim; authenticated/anon get DML grants and rely on RLS.
 * Re-runnable — called on every reset since the reset drops the auth
 * schema.
 */
async function installShims(sql: TestDb) {
  await sql.unsafe(`
    create schema if not exists auth;
    create schema if not exists public;
    create table if not exists auth.users (
      id uuid primary key default gen_random_uuid(),
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create or replace function auth.uid() returns uuid
    language sql stable
    as $fn$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $fn$;
    do $$ begin
      create role authenticated nologin;
      create role anon nologin;
      create role service_role nologin bypassrls;
    exception when duplicate_object then null; end $$;
    alter role service_role bypassrls;
    -- Note: roles are NOT granted to postgres (superuser) — Supabase keeps
    -- them separate, and superuser membership would bypass REVOKE/RLS.
    grant usage on schema public to authenticated, anon, service_role;
    -- Supabase grants authenticated/anon usage on the auth schema (needed
    -- by trigger functions and policies calling auth.uid() outside pure
    -- RLS-policy context).
    grant usage on schema auth to authenticated, anon, service_role;
    grant select, insert, update, delete on all tables in schema public
      to authenticated, anon, service_role;
    alter default privileges in schema public
      grant select, insert, update, delete on tables to authenticated, anon, service_role;
  `);
}

/** Resets the schema and applies every migration file in order. */
export async function applyMigrations(sql: TestDb) {
  await sql.unsafe(`drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;`);
  await installShims(sql);
  for (const file of MIGRATIONS) {
    const text = readFileSync(path.join(migrationsDir, file), "utf8");
    if (/^\s*begin;/m.test(text)) {
      await sql.unsafe(text);
    } else {
      await sql.begin((tx) => tx.unsafe(text));
    }
  }
  // Migrations may create new tables; keep role grants current.
  await sql.unsafe(`
    grant select, insert, update, delete on all tables in schema public
      to authenticated, anon, service_role;
  `);
}

/**
 * Runs `fn` inside a transaction bound to the `authenticated` role with
 * JWT sub = userId — equivalent to a Supabase per-actor client.
 */
export async function asUser<T>(
  sql: TestDb,
  userId: string,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe(`set local role authenticated`);
    await tx.unsafe(
      `select set_config('request.jwt.claim.sub', '${userId.replaceAll("'", "''")}', true)`,
    );
    return fn(tx);
  }) as Promise<T>;
}

/** Runs `fn` as the unauthenticated `anon` role (no claims). */
export async function asAnon<T>(
  sql: TestDb,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe(`set local role anon`);
    return fn(tx);
  }) as Promise<T>;
}

/** Runs `fn` as `service_role` — Supabase's bypass-RLS server context. */
export async function asServiceRole<T>(
  sql: TestDb,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe(`set local role service_role`);
    return fn(tx);
  }) as Promise<T>;
}

const UUIDS = {
  a: "00000000-0000-4000-8000-00000000000a",
  b: "00000000-0000-4000-8000-00000000000b",
} as const;

export const testUsers = UUIDS;
