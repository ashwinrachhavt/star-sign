// Supabase Edge Function entry points follow this exact shape.
// Shared plumbing lives in ../_shared/job.ts — a function file only:
// 1. names its job, 2. reads its idempotency key, 3. calls withJob().
import { withJob } from "../_shared/job.ts";

Deno.serve((req) => withJob("example-job", req, async () => {
  // Do the job's work here. Return a JSON-serializable result; it lands
  // in job_run_logs.detail and the response body.
  return { ok: true };
}));
