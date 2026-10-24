-- ASH-246 (3.1) + ASH-247 (3.2): ruleset version bump to 2026-10.2.
-- The interpretation ruleset changed from sun-sign-keyed to scored
-- transit-event-driven selection, and headlines moved to transit-keyed
-- templates with a 12-word ceiling. Consolidated here because both
-- tickets independently filed 0004 with the same default change.
-- Column defaults only — past readings keep the version they were
-- generated under (copy.md template hygiene).
--
-- Rollback:
--   alter table public.daily_readings
--     alter column ruleset_version set default '2026-10.1',
--     alter column copy_version set default '2026-10.1';
--   (Row values untouched; the undo is exact.)

begin;

alter table public.daily_readings
  alter column ruleset_version set default '2026-10.2',
  alter column copy_version set default '2026-10.2';

commit;
