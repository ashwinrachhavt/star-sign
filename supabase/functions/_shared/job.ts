// Shared Edge Function job plumbing (ASH-234 / 0.4a, 0.4c).
// Every scheduled/invoked job uses withJob(): it resolves the service-role
// client, enforces idempotency against job_run_logs, logs structured
// output, and captures failures with enough context to debug from logs
// alone. Function files should contain only the job's own logic.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface JobContext {
  db: ReturnType<typeof createClient>;
  /** Idempotency key: unique per logical run (e.g. "2026-10-24"). */
  key: string;
}

interface JobRunLog {
  status: "succeeded" | "failed";
}

export function resolveJobKey(req: Request, fallback: string): string {
  // Key comes from the cron payload (?key=) or the x-idempotency-key
  // header; callers with a natural key (a date) pass a fallback.
  const url = new URL(req.url);
  return req.headers.get("x-idempotency-key") ?? url.searchParams.get("key") ?? fallback;
}

export function svcClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

const MIN_RETRY_SECONDS = 5;

/**
 * Wraps a job body with the shared conventions:
 * - structured start/success/failure logs (job, key, cause, duration)
 * - idempotency: a (job, key) pair that already succeeded short-circuits
 * - failures record the cause in job_run_logs and return 500 (cron-safe;
 *   pg_cron/Supabase retries on non-2xx)
 */
export async function withJob(
  jobName: string,
  req: Request,
  body: (ctx: JobContext) => Promise<unknown>,
): Promise<Response> {
  const startedAt = Date.now();
  const key = resolveJobKey(req, new Date().toISOString().slice(0, 10));
  const log = (level: "info" | "error", event: string, extra: Record<string, unknown> = {}) =>
    console[level === "error" ? "error" : "log"](
      JSON.stringify({ event, job: jobName, key, ...extra }),
    );

  log("info", "job_start");

  const db = svcClient();

  // Idempotency gate: same (job, key) already succeeded → replay, no work.
  const { data: existing } = await db
    .from("job_run_logs")
    .select("status")
    .eq("job_name", jobName)
    .eq("idempotency_key", key)
    .maybeSingle<JobRunLog>();
  if (existing?.status === "succeeded") {
    log("info", "job_skipped_already_succeeded");
    return Response.json({ skipped: true, job: jobName, key });
  }

  try {
    const result = await body({ db, key });
    const { error: logErr } = await db.from("job_run_logs").upsert({
      job_name: jobName,
      idempotency_key: key,
      status: "succeeded",
      detail: result ?? {},
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date().toISOString(),
    });
    if (logErr) throw new Error(`job_run_logs upsert failed: ${logErr.message}`);

    log("info", "job_ok", { durationMs: Date.now() - startedAt });
    return Response.json({ ok: true, job: jobName, key, result: result ?? null });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await db.from("job_run_logs").upsert({
      job_name: jobName,
      idempotency_key: key,
      status: "failed",
      error_cause: message,
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date().toISOString(),
    });
    log("error", "job_failed", { cause: message, durationMs: Date.now() - startedAt });
    return Response.json({ error: message, job: jobName, key }, { status: 500 });
  }
}

export { MIN_RETRY_SECONDS };
