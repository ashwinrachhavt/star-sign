# Engineering Log

Append-only record of shipped changes. Format per `.agents/workflows.md`.

## 2026-10-24 — Data model v2: provenance, indexes, updated_at, IANA timezone, RLS harness (ASH-232)

- Change: Added provenance columns (`ruleset_version`, `copy_version`, `ephemeris_name`, `ephemeris_version`, `selected_events jsonb`) to `daily_readings` with v1-constant backfill defaults; indexed every FK (`daily_readings.user_id`, `reflections.user_id`, `people.owner_id`, `compatibility_reports.owner_id/person_id`); added `updated_at` columns + triggers on all six tables; added nullable `iana_timezone` on `birth_profiles` captured at onboarding (web + mobile), no fabricated backfill. New `packages/db` RLS harness: real Postgres (Docker, port 54329), Supabase role/`auth.uid()`/`auth.users` shims, 28 full-paranoia tests (per-table cross-user select/update/delete isolation, WITH CHECK rejection, anon zero-rows, service-role separation, deletion-cascade orphan checks, FK-index coverage, unique-constraint race, updated_at trigger).
- Migration: `supabase/migrations/0002_data_model_v2.sql`
- Rollback: header note in the migration file (drop columns/indexes/triggers/function); backfill reversal is lossless for v1 rows since all predate versioning.
- Risk: web/mobile inserts now write the new NOT NULL provenance columns — an app version older than this migration will fail inserts on a migrated database; rollout order is DB-then-app for prod. First noticed by daily-reading generation errors.
- Decisions: `daily_readings` unique `(user_id, for_date)` already existed in 0001 (ticket description was stale — noted on Linear); `iana_timezone` left nullable with `birth_time_zone` as read-path fallback instead of a fabricated backfill; harness uses `max:1` pool + transaction-local role/claim config (mirrors Supabase per-request semantics); ephemeris pinned to `astronomia@4.2.0` (lockfile-verified).

## 2026-10-24 — Rename Our Sky → Star Sign + repo baseline (pre-epic housekeeping)

- Change: Renamed packages (@our-sky/* → @star-sign/*), app display names, README, and UI strings to Star Sign; removed superseded agents/ discovery docs; fixed mobile lint script (`expo lint` → `eslint .`) and removed unused imports; seeded ENGINEERING_LOG.md; updated CLAUDE.md to route through `.agents/index.md`.
- Migration: none
- Rollback: revert PR
- Risk: cosmetic naming only; import specifier changes touch all workspace `@our-sky/core` references — CI/typecheck catches a miss. design/reference/ screenshots now gitignored (clean-room: reference material stays local).
- Decisions: `.agents/` brain docs remain untracked (local-only per owner's setup); PR covers rename + tooling, Linear epics untouched.
