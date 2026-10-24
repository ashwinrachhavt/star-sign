-- 0004: bump provenance version defaults for the transit-driven ruleset
-- (ASH-246 / 3.1). Column defaults only — no data changes; existing rows
-- keep the versions they were generated with.
--
-- Rollback: ALTER TABLE daily_readings ALTER COLUMN ruleset_version SET DEFAULT '2026-10.1';
--           ALTER TABLE daily_readings ALTER COLUMN copy_version SET DEFAULT '2026-10.1';

ALTER TABLE daily_readings
  ALTER COLUMN ruleset_version SET DEFAULT '2026-10.2',
  ALTER COLUMN copy_version SET DEFAULT '2026-10.2';
