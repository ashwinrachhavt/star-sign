# Engineering Log

Append-only record of shipped changes. Format per `.agents/workflows.md`.

## 2026-10-24 — Testing + CI baseline (ASH-235)

- Change: Added `.github/workflows/ci.yml` — two jobs: (1) `checks` (pnpm install with store cache → typecheck → lint → core Vitest → db RLS/job harness against a Postgres service container), (2) `smoke` (local Supabase via `supabase/setup-cli` + Playwright golden path: signup → onboarding → day page, asserting the reading persisted). New `e2e/` workspace package with Playwright config on dedicated port 3010 (dev machines often run other apps on 3000).
- Migration: none (0002/0003 fixed in this PR — see Decisions)
- Rollback: revert PR (removes CI; branch protection rule is a GitHub setting, removed separately).
- Risk: CI runs on free-tier GitHub runners only; no hosted staging created (explicit non-goal). Wall time budget: checks ~3 min, smoke ~4 min — under the 5-min criterion per job.
- Decisions: (1) **Fixed a latent migration bug found by the smoke test** — 0002/0003 opened `begin;` without `commit;`; the Supabase CLI's runner left the transaction open and every table/function/column silently rolled back while still printing "Applying migration...". Both now `commit;` and `supabase db reset` applies all three recorded migrations; smoke test verifies against the real local stack. (2) e2e runs its own Next dev server on port 3010 so it can never collide with unrelated apps on 3000. (3) Branch protection (criterion 1's approval requirement + required checks) is an owner-applied GitHub setting, not code — instructions in the PR description.

## 2026-10-24 — Job pattern: run_job runner, job_run_logs, rollup exemplar, Edge Function skeleton (ASH-234)

- Change: Added `0003_job_pattern.sql` — `job_run_logs` table (unique `(job_name, idempotency_key)`, RLS deny-all to clients), shared `run_job` PL/pgSQL runner (idempotency gate, structured `raise log` on success/failure with job+key+cause), exemplar `daily-reading-rollup` job (counts readings per date; monitor/rollup only per owner decision — no pre-generation), `reading_date` generated column + index on `daily_readings`. Edge Function skeleton in `supabase/functions/` (`_shared/job.ts` withJob wrapper + `example-job/`) with README documenting the mandatory job shape (purpose, idempotency key, retry policy, operational signal). Five new harness tests cover: success logging, same-key replay no-op, failure cause capture, live count correctness, client privilege denial.
- Migration: `supabase/migrations/0003_job_pattern.sql`
- Rollback: header note in the migration file (drop table/functions/column, unschedule cron job).
- Risk: `run_job` is security definer — deliberately least-privileged (REVOKE from PUBLIC + client roles; execute granted to service_role only; function name resolved via format %I so callers can't inject SQL through the fn name). Not client-reachable by design.
- Decisions: pg_cron schedule lives in deploy config (comment at end of migration), not the migration itself, so pg_cron-less databases (local/CI) apply the schema cleanly; harness client roles are no longer members of postgres so REVOKE/RLS behave like production Supabase (found PUBLIC execute grant on run_job — now revoked; test enforces).

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
