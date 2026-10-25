-- Notification preferences + dispatch log (ASH-263 / 7.1).
-- Preferences-first: defaults are quiet (nothing enabled); every delivery
-- is opt-in per event type and honors per-user quiet hours. Dispatch is
-- idempotent per (user, event, day) — retries never double-send.
--
-- Rollback:
--   drop table if exists public.notification_dispatch_log;
--   drop table if exists public.notification_preferences;
--   drop function if exists public.job_notification_dispatch(text);

begin;

-- Per-user notification preferences. One row per user, created on first
-- read (defaults quiet). Users own their row via RLS.
create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- Per-event-type opt-ins; all default FALSE (criterion 1).
  opt_full_moon boolean not null default false,
  opt_retrograde boolean not null default false,
  opt_weekly_digest boolean not null default false,
  -- Delivery window: local clock hours [start, end) in the user's IANA
  -- zone; dispatch never delivers outside it (criterion 2).
  quiet_start_hour int not null default 22 check (quiet_start_hour between 0 and 23),
  quiet_end_hour int not null default 8 check (quiet_end_hour between 0 and 23),
  iana_timezone text not null default 'America/New_York',
  -- Push token for the Expo adapter; null until the user enables push.
  push_token text,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "own preferences" on public.notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists notification_preferences_user_id_idx
  on public.notification_preferences (user_id);

-- Idempotency ledger: one row per (user, event, local day). Unique
-- constraint is the double-send guard (criterion 3).
create table public.notification_dispatch_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_kind text not null check (event_kind in ('full_moon', 'new_moon', 'retrograde_start', 'retrograde_end', 'weekly_digest')),
  event_key text not null,          -- e.g. 'full_moon:2026-01-03T10:03Z'
  for_date date not null,           -- user-local dispatch date
  dispatched_at timestamptz not null default now(),
  unique (user_id, event_kind, event_key, for_date)
);

alter table public.notification_dispatch_log enable row level security;

-- Dispatch rows are job-written (service role); clients never insert.
create policy "no client access" on public.notification_dispatch_log
  for all using (false) with check (false);

create index if not exists notification_dispatch_log_user_id_idx
  on public.notification_dispatch_log (user_id);

-- Dispatch job (0.4 pattern): reads stored sky_events, selects opted-in
-- users whose local delivery window contains "now", inserts-else-skips
-- into the dispatch log. Actual push sending is the adapter's job (the
-- job records intent; the adapter delivers and marks). Exposed through
-- the Edge Function worker entry point (supabase/functions/).
create or replace function public.job_notification_dispatch(p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eligible int := 0;
  v_recorded int := 0;
  v_event record;
  v_pref record;
  v_local_hour int;
  v_local_date date;
begin
  -- Today's + tomorrow's moon events from stored sky events (4.2).
  for v_event in
    select kind, body, detail, starts_at
    from public.sky_events
    where kind = 'moon_phase'
      and starts_at between now() - interval '1 day' and now() + interval '2 days'
  loop
    for v_pref in
      select p.user_id, p.opt_full_moon, p.opt_retrograde,
             p.quiet_start_hour, p.quiet_end_hour, p.iana_timezone
      from public.notification_preferences p
    loop
      -- Event-type opt-in (criterion 1).
      if v_event.detail = 'full' and not v_pref.opt_full_moon then
        continue;
      end if;

      -- Local hour + date in the user's zone.
      v_local_hour := extract(hour from (v_event.starts_at at time zone v_pref.iana_timezone))::int;
      v_local_date := (v_event.starts_at at time zone v_pref.iana_timezone)::date;

      -- Quiet hours (criterion 2): skip when inside [start, end).
      if (v_pref.quiet_start_hour <= v_pref.quiet_end_hour
          and v_local_hour >= v_pref.quiet_start_hour
          and v_local_hour < v_pref.quiet_end_hour)
         or (v_pref.quiet_start_hour > v_pref.quiet_end_hour
          and (v_local_hour >= v_pref.quiet_start_hour or v_local_hour < v_pref.quiet_end_hour)) then
        continue;
      end if;

      -- Idempotent insert (criterion 3): conflict → already sent.
      insert into public.notification_dispatch_log
        (user_id, event_kind, event_key, for_date)
      values
        (v_pref.user_id,
         case when v_event.kind = 'moon_phase' then 'full_moon' else v_event.kind end,
         v_event.kind || ':' || v_event.detail || ':' || v_event.starts_at::text,
         v_local_date)
      on conflict (user_id, event_kind, event_key, for_date) do nothing;

      if found then
        v_recorded := v_recorded + 1;
      end if;
      v_eligible := v_eligible + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'eligible', v_eligible,
    'newly_recorded', v_recorded
  );
end;
$$;

revoke execute on function public.job_notification_dispatch(text) from public, authenticated, anon;
grant execute on function public.job_notification_dispatch(text) to service_role;

commit;
