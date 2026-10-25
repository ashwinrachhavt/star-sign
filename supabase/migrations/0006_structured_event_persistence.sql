-- ASH-251 (3.6): structured event persistence contract on daily_readings.
--
-- selected_events (jsonb, from 0.2b) becomes a *contracted* store: a CHECK
-- constraint enforces that every persisted event is a well-formed structured
-- transit event — transiting body, natal body, aspect family, sign — with
-- kind/versioning headroom for future event kinds. Prose rows without events
-- stay valid (≥0 events, AC1); rows WITH events must carry the full shape,
-- so "facts, not just prose" is enforced by the database, not convention.
--
-- Postgres CHECK constraints cannot contain subqueries, so the validation
-- lives in an immutable helper function the constraint calls. The function
-- guards jsonb_array_elements behind a CASE (OR-chained arms are not
-- guaranteed to short-circuit before the set-returning call, which errors
-- on non-array input).
--
-- Rollback:
--   alter table public.daily_readings drop constraint if exists daily_readings_selected_events_shape;
--   drop function if exists public.valid_selected_events(jsonb);
--   (Constraint + helper only; the column and its data are untouched.)

begin;

create or replace function public.valid_selected_events(p_events jsonb)
returns boolean
language sql
immutable
as $fn$
  select case
    when p_events is null then true
    when jsonb_typeof(p_events) <> 'array' then false
    else not exists (
      select 1
      from jsonb_array_elements(p_events) el
      where not (
        jsonb_typeof(el) = 'object'
        and el->>'kind' is not null
        and (
          -- transit events: the structured facts behind the prose (ASH-251)
          (el->>'kind' = 'transit'
            and el->>'planet' in ('sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto')
            and el->>'natal' in ('sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto')
            and el->>'aspect' in ('conjunction','sextile','square','trine','opposition')
            and el->>'sign' in ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'))
          -- natal placements: the chart the events act on
          or (el->>'kind' = 'natal_placement'
            and el->>'planet' in ('sun','moon','mercury','venus','mars','jupiter','saturn','uranus','neptune','pluto')
            and el->>'sign' in ('aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'))
          -- lunar phase: the day's background weather
          or (el->>'kind' = 'lunar_phase' and el->>'phase' is not null)
        )
      )
    )
  end
$fn$;

alter table public.daily_readings
  add constraint daily_readings_selected_events_shape
  check (public.valid_selected_events(selected_events));

commit;
