/**
 * Notification dispatch tests (ASH-263 / 7.1 criteria 1-3).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarnessDb, applyMigrations, asUser, asServiceRole, type TestDb } from "./harness.js";

const A = "00000000-0000-4000-8000-00000000000a";

let sql: TestDb;

beforeAll(async () => {
  sql = await createHarnessDb();
  await applyMigrations(sql);
  await sql`insert into auth.users (id) values (${A}) on conflict do nothing`;
  await asServiceRole(sql, (tx) => tx`insert into profiles (id) values (${A}) on conflict do nothing`);
});

afterAll(async () => {
  await sql?.end();
});

async function setPrefs(partial: Record<string, unknown>) {
  await asUser(sql, A, (tx) => tx`update notification_preferences set ${sql(partial)} where user_id = ${A}`);
}

async function insertMoonEvent(detail: "full" | "new", at: Date) {
  await asServiceRole(sql, (tx) =>
    tx`insert into sky_events (kind, body, detail, starts_at)
       values ('moon_phase', 'moon', ${detail}, ${at.toISOString()})
       on conflict do nothing`,
  );
}

async function runDispatch() {
  return asServiceRole(sql, (tx) =>
    tx`select public.job_notification_dispatch('test-run') as r`,
  );
}

describe("notification preferences (criterion 1: defaults quiet)", () => {
  it("fresh preferences have everything off", async () => {
    await asUser(sql, A, (tx) =>
      tx`insert into notification_preferences (user_id) values (${A}) on conflict do nothing`,
    );
    const [row] = await asUser(sql, A, (tx) =>
      tx`select opt_full_moon, opt_retrograde, opt_weekly_digest from notification_preferences where user_id = ${A}`,
    );
    expect(row.opt_full_moon).toBe(false);
    expect(row.opt_retrograde).toBe(false);
    expect(row.opt_weekly_digest).toBe(false);
  });

  it("no dispatch recorded when nothing is opted in", async () => {
    await insertMoonEvent("full", new Date("2026-02-01T22:09:00Z"));
    await runDispatch();
    const logs = await asServiceRole(sql, (tx) =>
      tx`select count(*)::int as n from notification_dispatch_log where user_id = ${A}`,
    );
    expect(logs[0].n).toBe(0);
  });
});

describe("quiet hours (criterion 2)", () => {
  it("event inside the quiet window is not dispatched", async () => {
    // Full moon at 22:09 UTC; quiet window 22:00-08:00 local. With
    // timezone UTC, 22:09 falls inside quiet → skipped.
    await setPrefs({ opt_full_moon: true, quiet_start_hour: 22, quiet_end_hour: 8, iana_timezone: "UTC" });
    await insertMoonEvent("full", new Date("2026-02-01T22:09:00Z"));
    const before = await asServiceRole(sql, (tx) =>
      tx`select count(*)::int as n from notification_dispatch_log where user_id = ${A}`);
    await runDispatch();
    const after = await asServiceRole(sql, (tx) =>
      tx`select count(*)::int as n from notification_dispatch_log where user_id = ${A}`);
    expect(after[0].n).toBe(before[0].n);
  });

  it("event outside the quiet window dispatches", async () => {
    await setPrefs({ opt_full_moon: true, quiet_start_hour: 22, quiet_end_hour: 8, iana_timezone: "UTC" });
    // Noon tomorrow UTC — inside the job's ±2-day scan, outside 22-8 quiet.
    const at = new Date(Date.now() + 36 * 3600 * 1000);
    at.setUTCHours(12, 0, 0, 0);
    await insertMoonEvent("full", at);
    await runDispatch();
    const logs = await asServiceRole(sql, (tx) =>
      tx`select count(*)::int as n from notification_dispatch_log where user_id = ${A} and event_kind = 'full_moon'`);
    expect(logs[0].n).toBeGreaterThanOrEqual(1);
  });
});

describe("idempotent dispatch (criterion 3)", () => {
  it("running dispatch twice never double-sends", async () => {
    await setPrefs({ opt_full_moon: true, quiet_start_hour: 22, quiet_end_hour: 8, iana_timezone: "UTC" });
    const r1 = await runDispatch();
    const r2 = await runDispatch();
    const first = Number((r1[0] as { r: { newly_recorded: number } }).r.newly_recorded);
    const second = Number((r2[0] as { r: { newly_recorded: number } }).r.newly_recorded);
    expect(first).toBeGreaterThanOrEqual(0);
    // Second run records nothing new for the same (user, event, day).
    expect(second).toBe(0);
  });
});

describe("user control (criterion 4)", () => {
  it("user can opt out after opting in — no further dispatch", async () => {
    await setPrefs({ opt_full_moon: false });
    await insertMoonEvent("full", new Date("2026-04-01T12:00:00Z"));
    const before = await asServiceRole(sql, (tx) =>
      tx`select count(*)::int as n from notification_dispatch_log where user_id = ${A}`);
    await runDispatch();
    const after = await asServiceRole(sql, (tx) =>
      tx`select count(*)::int as n from notification_dispatch_log where user_id = ${A}`);
    expect(after[0].n).toBe(before[0].n);
  });

  it("clients cannot write the dispatch log (job-only)", async () => {
    await expect(
      asUser(sql, A, (tx) =>
        tx`insert into notification_dispatch_log (user_id, event_kind, event_key, for_date)
           values (${A}, 'full_moon', 'spoof', '2026-01-01')`,
      ),
    ).rejects.toThrowError(/row-level security|policy/i);
  });
});
