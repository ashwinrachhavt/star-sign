-- Onboarding tracking + place geocoding cache (owner request, 2026-10-25).
--
-- onboarding_profiles: who is onboarding and everything they entered —
-- one row per account, updated as the user moves through the flow. The
-- Clerk subject is recorded when Clerk auth is active (null for legacy
-- Supabase-auth rows); identity resolution stays with
-- profiles.clerk_subject (0009) — this table is observability, not auth.
--
-- places: geocode cache. Place-label → coordinates resolved server-side
-- (Open-Meteo geocoding, free, no key) and cached so repeated lookups
-- never re-hit the provider.
--
-- Rollback:
--   drop table if exists public.places;
--   drop table if exists public.onboarding_profiles;

begin;

create table public.onboarding_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  clerk_subject text,                      -- recorded when Clerk auth active
  auth_provider text not null default 'supabase'
    check (auth_provider in ('supabase', 'clerk')),
  display_name text,
  email text,                              -- login identifier (PII: user-owned row only)
  -- Everything the user entered, in flow order:
  birth_date date,
  birth_time time,
  birth_time_precision text check (birth_time_precision in ('exact', 'approximate', 'unknown')),
  birth_time_zone text,
  birth_place_label text,
  birth_lat double precision,
  birth_lon double precision,
  -- Flow state:
  started_at timestamptz not null default now(),
  completed_at timestamptz,               -- set when birth profile saved
  updated_at timestamptz not null default now()
);

alter table public.onboarding_profiles enable row level security;

-- The user owns their onboarding row; service role writes during flows.
create policy "own onboarding row" on public.onboarding_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index onboarding_profiles_user_id_idx on public.onboarding_profiles (user_id);

-- Geocode cache: keyed by normalized label + zone-ish grouping. Rows are
-- public astronomical/geographic facts (no user data) — readable by
-- authenticated clients, writable by the server geocode route only.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  label text not null,                     -- original query
  normalized text not null,                -- lowercased, trimmed
  lat double precision not null,
  lon double precision not null,
  resolved_name text,                      -- provider's canonical name
  country text,
  timezone text,                           -- provider's IANA zone suggestion
  source text not null default 'open-meteo',
  resolved_at timestamptz not null default now(),
  unique (normalized)
);

alter table public.places enable row level security;

create policy "authenticated read" on public.places
  for select to authenticated using (true);

create index places_normalized_idx on public.places (normalized);

commit;
