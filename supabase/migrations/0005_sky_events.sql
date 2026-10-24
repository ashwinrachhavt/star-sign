-- Sky events table (ASH-253 / 4.2): stored lunar phases + retrograde
-- windows, computed once by a job and queried by the week-ahead timeline
-- (4.1) and notifications (7.1). Windows are data, not ad-hoc per-request
-- computation.
--
-- Rollback:
--   drop table if exists public.sky_events;
--   drop function if exists public.job_sky_event_scan(text);

begin;

create table public.sky_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('moon_phase', 'retrograde_window')),
  body text not null,                        -- 'moon' or planet name
  detail text not null,                      -- 'full' | 'new' | retrograde direction
  starts_at timestamptz not null,
  ends_at timestamptz,                       -- null for point events (moon phases)
  computed_at timestamptz not null default now(),
  -- One row per (kind, body, detail, start): idempotent reseeds.
  unique (kind, body, detail, starts_at)
);

alter table public.sky_events enable row level security;

-- Sky events are public astronomical facts (no user data); any
-- authenticated reader may query them. Writes go through the job runner
-- (service role / postgres) only.
create policy "authenticated read" on public.sky_events
  for select to authenticated using (true);

-- Rescan job: idempotent upsert of the next year of moon phases + the
-- current year's retrograde windows. Runs via run_job with a date key.
create or replace function public.job_sky_event_scan(p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_moons int;
  v_windows int;
begin
  -- Placeholder: row insertion is driven by the TypeScript scanner, which
  -- computes exact instants with astronomy-engine and upserts via the
  -- service role. This job function records the scan invocation so run_job
  -- idempotency covers manual re-runs; the TS worker entry point performs
  -- the actual upserts (see apps/web/server/jobs/sky-scan.ts).
  select count(*) into v_moons from public.sky_events where kind = 'moon_phase';
  select count(*) into v_windows from public.sky_events where kind = 'retrograde_window';
  return jsonb_build_object(
    'scan_key', p_idempotency_key,
    'moon_phases_stored', v_moons,
    'retrograde_windows_stored', v_windows
  );
end;
$$;

revoke execute on function public.job_sky_event_scan(text) from public, authenticated, anon;
grant execute on function public.job_sky_event_scan(text) to service_role;

commit;
