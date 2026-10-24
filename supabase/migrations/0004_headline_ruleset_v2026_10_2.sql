-- ASH-247: headline ruleset v2026-10.2 (transit-driven, ≤12 words)
--
-- The headline selection ruleset changed from sun-sign-keyed templates to
-- transit-event-keyed templates (RULESET_VERSION/COPY_VERSION 2026-10.1 →
-- 2026-10.2). Per copy.md template hygiene, past readings keep the version
-- they were written under — only the default for new rows moves.
--
-- Rollback:
--   alter table public.daily_readings
--     alter column ruleset_version set default '2026-10.1',
--     alter column copy_version set default '2026-10.1';
--   (Row values are untouched by this migration — only defaults change —
--   so the undo is exact.)

begin;

alter table public.daily_readings
  alter column ruleset_version set default '2026-10.2',
  alter column copy_version set default '2026-10.2';

commit;
