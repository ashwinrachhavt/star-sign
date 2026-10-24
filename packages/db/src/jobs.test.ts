import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarnessDb, applyMigrations, asAnon, type TestDb } from "./harness.js";

let sql: TestDb;

beforeAll(async () => {
  sql = await createHarnessDb();
  await applyMigrations(sql);
});

afterAll(async () => {
  await sql?.end();
});

describe("job pattern (ASH-234)", () => {
  it("run_job succeeds and logs the rollup detail", async () => {
    const result = await sql`
      select public.run_job('daily-reading-rollup', '2026-10-24', 'job_daily_reading_rollup') as r`;
    expect(result[0].r).toMatchObject({ rollup_date: "2026-10-24", readings_generated: 0 });

    const [log] = await sql`
      select status, detail from public.job_run_logs
      where job_name = 'daily-reading-rollup' and idempotency_key = '2026-10-24'`;
    expect(log.status).toBe("succeeded");
    expect(log.detail).toMatchObject({ readings_generated: 0 });
  });

  it("running the same (job, key) twice produces no duplicate side effects", async () => {
    await sql`select public.run_job('daily-reading-rollup', '2026-10-25', 'job_daily_reading_rollup')`;
    const replay = await sql`
      select public.run_job('daily-reading-rollup', '2026-10-25', 'job_daily_reading_rollup') as r`;
    expect(replay[0].r).toMatchObject({ skipped: true });

    const logs = await sql`
      select idempotency_key from public.job_run_logs
      where job_name = 'daily-reading-rollup' and idempotency_key = '2026-10-25'`;
    expect(logs).toHaveLength(1);
  });

  it("failed job records cause with job name and key", async () => {
    // Point run_job at a nonexistent function → exception path.
    const result = await sql`
      select public.run_job('bad-job', 'k1', 'no_such_function') as r`;
    expect(result[0].r.error).toContain("no_such_function");

    const [log] = await sql`
      select status, error_cause from public.job_run_logs
      where job_name = 'bad-job' and idempotency_key = 'k1'`;
    expect(log.status).toBe("failed");
    expect(log.error_cause).toContain("no_such_function");
  });

  it("rollup counts actual readings for the date", async () => {
    await sql`insert into auth.users (id) values ('00000000-0000-4000-8000-00000000000c') on conflict do nothing`;
    await sql`insert into profiles (id) values ('00000000-0000-4000-8000-00000000000c') on conflict do nothing`;
    await sql`
      insert into daily_readings (user_id, for_date, headline, explanation, dos, donts, life_areas, provenance, uncertainty_note)
      values ('00000000-0000-4000-8000-00000000000c', '2026-10-26', 'h', 'e', '[]', '[]', '[]', '{}', 'u')`;

    const result = await sql`
      select public.run_job('daily-reading-rollup', '2026-10-26', 'job_daily_reading_rollup') as r`;
    expect(result[0].r).toMatchObject({ readings_generated: 1, users_with_readings: 1 });
  });

  it("clients cannot touch job_run_logs or run jobs (RLS + revoked execute)", async () => {
    await expect(
      asAnon(sql, (tx) => tx`select * from public.job_run_logs`),
    ).resolves.toHaveLength(0);
    await expect(
      asAnon(sql, (tx) => tx`select public.run_job('x', 'y', 'job_daily_reading_rollup')`),
    ).rejects.toThrowError(/permission denied|not permitted/i);
  });
});
