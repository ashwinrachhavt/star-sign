# Supabase functions — job pattern

Every scheduled/background job in Star Sign follows one shape. Copy
`example-job/` when adding a job; do not invent a new pattern.

## The rules (per `.agents/engineering.md`)

Each job declares, in its file header comment:

1. **Purpose** — one line, what it does and why it exists.
2. **Idempotency key** — what makes a run unique (a date, an entity id).
   Running twice with the same key must produce no duplicate side effects;
   `withJob` enforces this against `public.job_run_logs`
   (unique `(job_name, idempotency_key)`).
3. **Retry policy** — the runner returns non-2xx on failure so the
   scheduler retries; `withJob`'s idempotency gate makes retries safe.
4. **Operational signal** — structured JSON logs (`job_start`, `job_ok`,
   `job_failed` with job name, key, cause, duration) and a
   `job_run_logs` row per attempt.

## Anatomy

```
supabase/functions/
  _shared/job.ts     ← withJob(), service-role client, logging — shared
  example-job/       ← copy me; contains only the job's own logic
```

A function file is ~10 lines: name, key resolution, `withJob()`.

## SQL-side jobs (pg_cron)

Jobs that live entirely in the database use migration 0003's runner:

```sql
select public.run_job('job-name', 'idempotency-key', 'job_function_name');
```

`run_job` provides the same idempotency + structured logging contract via
`job_run_logs` and `raise log`. The pg_cron schedule itself is applied at
deploy time (see the comment at the end of `0003_job_pattern.sql`), so
local/test databases without pg_cron still apply the schema cleanly.

## Hard rule

No job pre-generates user readings (owner decision, 2026-10-24). Cron is
monitoring/rollup only until open-time latency is a measured problem.
