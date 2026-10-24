-- Job infrastructure (ASH-234 / 0.4): ops table + exemplar rollup job.
--
-- Rollback:
--   drop table if exists public.job_run_logs;
--   select cron.unschedule('daily-reading-rollup') where cron.jobname = 'daily-reading-rollup';
--   drop function if exists public.job_daily_reading_rollup(text);
--   drop function if exists public.run_job(text, text);
--   alter table public.daily_readings drop column if exists reading_date;

begin;

-- Job runs are logged with (job_name, idempotency_key) unique so a retry
-- with the same key is a no-op — criterion 2.
create table public.job_run_logs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  idempotency_key text not null,
  status text not null check (status in ('succeeded', 'failed')),
  detail jsonb not null default '{}'::jsonb,
  error_cause text,
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  unique (job_name, idempotency_key)
);

alter table public.job_run_logs enable row level security;

-- Jobs write through the owner (postgres) role; no client role may touch
-- job logs. Service-role access is for ops dashboards only.
create policy "no client access" on public.job_run_logs
  for all using (false) with check (false);

-- The ephemeris "day" a reading belongs to, for rollup grouping. Backfill
-- from for_date (readings are generated for the account-local date).
alter table public.daily_readings add column if not exists reading_date date
  generated always as (for_date) stored;

create index if not exists daily_readings_reading_date_idx
  on public.daily_readings (reading_date);

-- Shared runner: every scheduled job goes through run_job so idempotency,
-- structured logging, and failure capture are one code path (0.4c).
-- fn_name must resolve to a function (text) returning jsonb.
create or replace function public.run_job(
  p_job_name text,
  p_idempotency_key text,
  p_fn_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_result jsonb;
begin
  -- Idempotency: same (job, key) already succeeded → replay, no side effects.
  insert into public.job_run_logs (job_name, idempotency_key, status, detail, started_at)
  values (p_job_name, p_idempotency_key, 'failed', '{}', v_started)
  on conflict (job_name, idempotency_key) do nothing;

  if (select status from public.job_run_logs
      where job_name = p_job_name and idempotency_key = p_idempotency_key) = 'succeeded' then
    return jsonb_build_object('skipped', true, 'job', p_job_name, 'key', p_idempotency_key);
  end if;

  begin
    execute format('select public.%I(%L)', p_fn_name, p_idempotency_key) into v_result;

    update public.job_run_logs
    set status = 'succeeded',
        detail = coalesce(v_result, '{}'::jsonb),
        finished_at = clock_timestamp()
    where job_name = p_job_name and idempotency_key = p_idempotency_key;

    raise log 'job_ok job=% key=% result=%', p_job_name, p_idempotency_key, v_result::text;
    return v_result;
  exception when others then
    update public.job_run_logs
    set status = 'failed',
        error_cause = sqlerrm,
        finished_at = clock_timestamp()
    where job_name = p_job_name and idempotency_key = p_idempotency_key;

    -- Structured failure log: job name, key, cause (criterion 3).
    raise log 'job_failed job=% key=% cause=%', p_job_name, p_idempotency_key, sqlerrm;
    return jsonb_build_object('error', sqlerrm, 'job', p_job_name, 'key', p_idempotency_key);
  end;
end;
$$;

-- Exemplar job (0.4b): daily-reading-rollup — counts readings generated
-- per day for the requested date, writes the counts as the job's detail.
-- Idempotent by construction: it only reads daily_readings and upserts its
-- own log row; running twice for the same key is a no-op via run_job.
create or replace function public.job_daily_reading_rollup(p_idempotency_key text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'rollup_date', p_idempotency_key,
    'readings_generated', (select count(*)::int from public.daily_readings where reading_date = p_idempotency_key::date),
    'users_with_readings', (select count(distinct user_id)::int from public.daily_readings where reading_date = p_idempotency_key::date)
  );
$$;

-- Jobs are server-side only: PUBLIC has execute by default in Postgres,
-- so revoke from all client roles AND public. service_role (bypassrls,
-- server-only) retains the grant it would get from PUBLIC otherwise.
revoke execute on function public.run_job(text, text, text) from public;
revoke execute on function public.run_job(text, text, text) from authenticated, anon;
revoke execute on function public.job_daily_reading_rollup(text) from public;
revoke execute on function public.job_daily_reading_rollup(text) from authenticated, anon;
grant execute on function public.run_job(text, text, text) to service_role;

-- pg_cron schedule: applied at deploy time (Supabase project with pg_cron
-- enabled), not in this migration, so non-cron databases (local/test) can
-- apply the schema cleanly. Deploy step, run once as postgres:
--
--   create extension if not exists pg_cron;
--   select cron.schedule(
--     'daily-reading-rollup',
--     '0 4 * * *',
--     $$ select public.run_job('daily-reading-rollup',
--        to_char(current_date - 1, 'YYYY-MM-DD'), 'job_daily_reading_rollup') $$
--   );
