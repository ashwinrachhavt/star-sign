-- ASH-268: copy version bump to 2026-10.3. The life_areas payload shape
-- changed from plain area-name strings to {area, temperature} objects;
-- the new copy pack version distinguishes rows written under the old
-- shape (parse tolerantly, render "—" for old rows — no data migration).
-- Column default only — past readings keep the version they were
-- generated under (copy.md template hygiene).
--
-- Rollback:
--   alter table public.daily_readings
--     alter column copy_version set default '2026-10.2';
--   (Row values untouched; the undo is exact.)

begin;

alter table public.daily_readings
  alter column copy_version set default '2026-10.3';

commit;
