-- Spec W2b: reading-engine version bump to 2026-11.1 (ruleset + copy).
-- The life-area scale went four-state (charged/warm/steady/strained) over
-- the full 7-area set, do/don't pairs became same-event, and proof lines
-- joined dive-deeper. The new versions distinguish rows written under
-- 2026-10.2/2026-10.3 (ash-268 hot/warm/quiet rows parse tolerantly and
-- render their own names — no data migration).
-- Column defaults only — past readings keep the version they were
-- generated under (copy.md template hygiene).
--
-- Rollback:
--   alter table public.daily_readings
--     alter column ruleset_version set default '2026-10.2';
--   alter table public.daily_readings
--     alter column copy_version set default '2026-10.3';
--   (Row values untouched; the undo is exact.)

begin;

alter table public.daily_readings
  alter column ruleset_version set default '2026-11.1';
alter table public.daily_readings
  alter column copy_version set default '2026-11.1';

commit;
