# Engineering Log

Append-only record of shipped changes. Format per `.agents/workflows.md`.

## 2026-10-24 — Headline quality bar: transit-driven, ≤12 words (ASH-247)

- Change: Headline selection rewired from sun-sign-keyed templates (`HEADLINES["sun+aries"]`, which ignored the day's actual sky) to transit-event-keyed templates — `TRANSIT_HEADLINES["${planet}+${aspect}"]` (16 keys: mercury/venus/mars × 5 aspect families + mercury retrograde), selected from the same fast-transit pick that feeds `provenance.selectedEvents`, so the headline and the provenance event always correlate. Natal-sign lines kept only as the no-qualifying-transit fallback (quiet-sky pool). Generator enforces the ≤12-word ceiling via `enforceWordLimit` (sentence-split then truncate — template trust is never assumed, per copy.md template hygiene). Sweep test: 20 dates × 3 profiles (exact/approx/unknown) = 60 readings, all ≤12 words; correlation test asserts headline pool key matches the selected provenance transit; AC1 test asserts different dominant transit → different headline.
- Migration: `supabase/migrations/0004_headline_ruleset_v2026_10_2.sql` (defaults only — ruleset_version/copy_version 2026-10.1 → 2026-10.2 for new rows; past readings keep their written-under version per copy.md)
- Rollback: header note in the migration (alter defaults back to 2026-10.1; row values untouched, undo is exact); code revert via PR revert.
- Risk: headline copy changes under a familiar ruleset-version shape — clients displaying cached readings see old headlines with old versions, which is correct behavior. Templates are hand-reviewed against copy.md (second person, no certainty inflation, no fear-mongering, verb-first where imperative); the 12-word guard catches template drift mechanically.
- Decisions: (1) Built the minimal versioned ruleset shape here rather than waiting for ASH-246's restructure — `TRANSIT_HEADLINES` is a standalone const, so eb's 3.1 rewire can absorb or rename it without semantic conflict; coordinated via our-sky-da that 246 had not merged. (2) Version bump includes COPY_VERSION (template text changed → new copy pack per copy.md hygiene). (3) Correlation is asserted structurally (headline pool key ↔ selectedEvents) rather than by keyword-matching English text, which would be brittle.

## 2026-10-24 — API design pattern: route handlers, contracts, rate limits (ASH-233)

- Change: Materialized `.agents/api.md` as code. New `packages/core/src/contracts.ts` — Zod schemas are the single definition for every transport payload (birth profile, person, reflection, daily reading request), domain types derive via z.infer. New `apps/web/app/api/` — `_lib/api.ts` (jsonOk/jsonCreated/jsonError envelopes with meta.requestId, parseBody 400 details, requireActor 401 guard, notFoundIfForeign 404-not-403, in-process token-bucket rate limiter) plus route handlers for all five mutation groups: daily-readings (POST create→201/existing→200, GET read-only), me/birth-profile (GET/PUT), people (GET/POST/DELETE, foreign target → 404), reflections (GET paginated cursor list/POST), reflections/[id] (GET/PATCH/DELETE, idempotent 204). Mobile day screen now reads/writes via the same API (`apps/mobile/src/lib/api.ts`, bearer-token authenticated) — parity proven; RLS-direct read kept only for the birth-profile existence check documented in api.ts. Web gains test/typecheck scripts (closes the 0.5-flagged gap); 10 API contract tests pin the status map.
- Migration: none
- Rollback: revert PR (routes are additive; mobile falls back to nothing — mobile previously wrote readings RLS-direct, so revert restores that path).
- Risk: rate limiter is in-process per serverless instance (documented fail-open choice — generation is DB-unique-constrained anyway, so a limiter miss degrades to the idempotency guard, not abuse). Shared-store limiter is a follow-up when abuse is measured. Handlers trust `supabase.auth.getUser()` for identity — Clerk migration (ASH-231) will swap the guard implementation, not the call sites.
- Decisions: rate-limit mechanism = in-process token bucket (filed per ticket 0.3d); cursor pagination = opaque created_at ISO string (api.md's stable ordering); DELETE people takes `?id=` query param (v1 — no dynamic route needed until EPIC 5); zod pinned ^3 (v4 ESM interop unresolved at time of writing).

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

## 2026-10-24 — Transit-driven life areas + dos/don'ts (ASH-246)

- Change: Interpretation rewired from sun-sign mapping to scored transit events. New `packages/core/src/ruleset.ts` — event→life-area rules (transiting planet theme + natal-target refinement), aspect/orb/retrograde scoring, hot/warm/quiet ranking, event-traced dos/don'ts pools keyed by transiting planet and aspect family. `reading.ts` consumes it: areas ranked by summed event scores (never sun signs), dos/don'ts selected only from events recorded in `provenance.selectedEvents` (top-5 by score), strongest event drives the explanation theme. RULESET/COPY versions bumped to 2026-10.2.
- Migration: 0004_ruleset_version_bump.sql (column defaults only)
- Rollback: revert PR; DB undo in migration header comment.
- Risk: readings generated after this change carry 2026-10.2 provenance — persisted rows keep old versions (no rewrite of past readings per copy.md template hygiene). Life-area lists can be shorter on eventless days (no generic padding, traceability rule); UI already tolerates variable-length lists.
- Decisions: (1) `ReadingProvenanceInput` transit variant gains optional `aspect` field (additive, peer-coordinated) so each selected event carries its aspect family. (2) Dos/don'ts no longer padded to three from generic pools — traceability criterion beats the old "always three" shape; existing UI handles 0–3 items. (3) Outer→outer transit events excluded (move too slowly to feel "today"); at least one personal planet required per event. (4) Provenance harness generalized to latest-wins scan of all migrations (was hardcoded to 0002), so future version bumps only add a migration.
