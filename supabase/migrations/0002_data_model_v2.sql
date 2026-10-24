-- Data model v2: versioning, constraints, indexes (ASH-232)
--
-- Rollback:
--   alter table public.birth_profiles drop column if exists iana_timezone;
--   drop trigger if exists set_updated_at on public.compatibility_reports;
--   drop trigger if exists set_updated_at on public.reflections;
--   drop trigger if exists set_updated_at on public.people;
--   drop trigger if exists set_updated_at on public.birth_profiles;
--   drop trigger if exists set_updated_at on public.daily_readings;
--   drop trigger if exists set_updated_at on public.profiles;
--   drop function if exists public.set_updated_at();
--   drop index if exists public.compatibility_reports_person_id_idx;
--   drop index if exists public.compatibility_reports_owner_id_idx;
--   drop index if exists public.people_owner_id_idx;
--   drop index if exists public.reflections_user_id_idx;
--   drop index if exists public.daily_readings_user_id_idx;
--   drop index if exists public.birth_profiles_iana_timezone_idx;
--   alter table public.daily_readings
--     drop column if exists selected_events,
--     drop column if exists ephemeris_version,
--     drop column if exists ephemeris_name,
--     drop column if exists copy_version,
--     drop column if exists ruleset_version;
--   (Reversing the NOT NULL backfill is lossy only for rows whose values
--   differed from the backfill constant; v1 rows all predate versioning,
--   so re-inserting 2026-10.1 is a faithful undo.)

begin;

-- 0.2b — provenance columns on daily_readings ------------------------------
-- Existing rows predate versioning; the v1 constants in
-- packages/core/src/reading.ts are their faithful provenance.
-- (Defaults updated in ASH-236 when the ephemeris moved to astronomy-engine;
-- rows written under the old astronomia calculator keep their own column
-- values — only the default for new rows changed.)
alter table public.daily_readings
  add column ruleset_version text not null default '2026-10.1',
  add column copy_version text not null default '2026-10.1',
  add column ephemeris_name text not null default 'astronomy-engine',
  add column ephemeris_version text not null default '2.1.19',
  add column selected_events jsonb not null default '[]'::jsonb;

-- 0.2d — IANA timezone on birth_profiles -----------------------------------
alter table public.birth_profiles
  add column if not exists iana_timezone text;

-- 0.2c — constraints + indexes --------------------------------------------
-- The unique constraint already exists from 0001 (unique (user_id,
-- for_date)); kept as-is, verified by the RLS/contract harness.

create index if not exists daily_readings_user_id_idx
  on public.daily_readings (user_id);
create index if not exists reflections_user_id_idx
  on public.reflections (user_id);
create index if not exists people_owner_id_idx
  on public.people (owner_id);
create index if not exists compatibility_reports_owner_id_idx
  on public.compatibility_reports (owner_id);
create index if not exists compatibility_reports_person_id_idx
  on public.compatibility_reports (person_id);
-- Golden-path lookup: users in a zone for future notification scheduling
create index if not exists birth_profiles_iana_timezone_idx
  on public.birth_profiles (iana_timezone);

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.birth_profiles add column if not exists updated_at timestamptz not null default now();
alter table public.daily_readings add column if not exists updated_at timestamptz not null default now();
alter table public.people add column if not exists updated_at timestamptz not null default now();
alter table public.compatibility_reports add column if not exists updated_at timestamptz not null default now();
alter table public.reflections add column if not exists updated_at timestamptz not null default now();

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.birth_profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.daily_readings
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.people
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.compatibility_reports
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.reflections
  for each row execute function public.set_updated_at();

commit;

-- 0.2d — IANA timezone on birth_profiles: added above (line 42), before
-- the index that references it. Fallback in the read path is the existing
-- birth_time_zone; the column stays nullable so old profiles exist without
-- a fabricated zone.
