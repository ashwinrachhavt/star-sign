-- 0007: Clerk identity bridge (ASH-231 / 0.1b).
--
-- Architecture ruling (peer ticket comment, 2026-10-25; per
-- architecture.md §4): profiles.id stays UUID for all data tables so
-- every existing RLS policy (auth.uid() = user_id) keeps resolving; the
-- Clerk subject maps onto profiles via a unique text column.
--
-- Identity flow after this migration: Clerk issues the session; the
-- app resolves the Clerk subject to a profile UUID (requireActor);
-- Supabase JWTs are minted per-session with sub = profile UUID (the
-- third-party-auth integration or the sign-in bridge), so auth.uid()
-- inside RLS remains the profile UUID it has always been.
--
-- Rollback: ALTER TABLE public.profiles DROP COLUMN clerk_subject;
--           (drop index automatically)

alter table public.profiles
  add column clerk_subject text unique,
  add column auth_provider text not null default 'supabase'
    check (auth_provider in ('supabase', 'clerk'));

create index profiles_clerk_subject_idx on public.profiles (clerk_subject);

-- Backfill guard: clerk_subject is nullable so existing Supabase-auth
-- users (and the local test harness's synthetic users) keep working —
-- no lockout (criterion 2). Rows created by the app from Clerk sessions
-- always carry a non-null subject.
