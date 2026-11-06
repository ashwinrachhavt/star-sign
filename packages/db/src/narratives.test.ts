/**
 * ai_narratives RLS + constraint tests (0019).
 *
 * The narrative cache is per-user private data: only the owning actor
 * reads or writes their rows through RLS; service_role (the API server)
 * bypasses. The unique key (user, scope, for_date, variant) is the
 * cache-idempotency contract the orchestrator's race readback relies on.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createHarnessDb,
  applyMigrations,
  asUser,
  asServiceRole,
  asAnon,
  testUsers,
  type TestDb,
} from "./harness.js";

const A = testUsers.a;
const B = testUsers.b;

let sql: TestDb;

function narrativeRow(userId: string) {
  return {
    user_id: userId,
    scope: "daily",
    for_date: "2026-11-05",
    narrative: "A restated sky.",
    model_name: "mercury-3",
    model_version: "mercury-3",
    prompt_version: "narrative/v1",
    facts_digest: "deadbeef",
  };
}

beforeAll(async () => {
  sql = await createHarnessDb();
  await applyMigrations(sql);
  await sql`insert into auth.users (id) values (${A}), (${B}) on conflict do nothing`;
  await asServiceRole(sql, (tx) =>
    tx`insert into profiles (id) values (${A}), (${B}) on conflict do nothing`,
  );
});

afterAll(async () => {
  await sql?.end();
});

describe("ai_narratives RLS (0019)", () => {
  it("owner inserts and reads their own cached narrative", async () => {
    await asUser(sql, A, (tx) =>
      tx`insert into ai_narratives ${tx(narrativeRow(A), "user_id", "scope", "for_date", "narrative", "model_name", "model_version", "prompt_version", "facts_digest")}`,
    );
    const [row] = await asUser(sql, A, (tx) =>
      tx`select narrative, scope from ai_narratives where user_id = ${A}`,
    );
    expect(row.scope).toBe("daily");
    expect(row.narrative).toBe("A restated sky.");
  });

  it("another actor sees nothing (isolation)", async () => {
    const rows = await asUser(sql, B, (tx) =>
      tx`select * from ai_narratives where user_id = ${A}`,
    );
    expect(rows).toEqual([]);
  });

  it("another actor cannot forge a row under someone else's id", async () => {
    await expect(
      asUser(sql, B, (tx) =>
        tx`insert into ai_narratives ${tx(narrativeRow(A), "user_id", "scope", "for_date", "narrative", "model_name", "model_version", "prompt_version", "facts_digest")}`,
      ),
    ).rejects.toThrow();
  });

  it("anon sees nothing (RLS filters, no policy)", async () => {
    const rows = await asAnon(sql, (tx) => tx`select * from ai_narratives`);
    expect(rows).toEqual([]);
  });

  it("service_role (API server) reads across users", async () => {
    const rows = await asServiceRole(sql, (tx) =>
      tx`select user_id from ai_narratives`,
    );
    expect(rows.length).toBe(1);
    expect(rows[0].user_id).toBe(A);
  });

  it("duplicate (user, scope, for_date, variant) raises — the cache race key", async () => {
    await expect(
      asServiceRole(sql, (tx) =>
        tx`insert into ai_narratives ${tx(narrativeRow(A), "user_id", "scope", "for_date", "narrative", "model_name", "model_version", "prompt_version", "facts_digest")}`,
      ),
    ).rejects.toThrow(/duplicate key|unique constraint/i);
  });

  it("variant disambiguates ask questions on the same day", async () => {
    const row = narrativeRow(A);
    await asServiceRole(sql, (tx) =>
      tx`insert into ai_narratives ${tx({ ...row, scope: "ask", variant: "q1" }, "user_id", "scope", "for_date", "variant", "narrative", "model_name", "model_version", "prompt_version", "facts_digest")}`,
    );
    const rows = await asServiceRole(sql, (tx) =>
      tx`select scope, variant from ai_narratives where user_id = ${A} order by scope`,
    );
    expect(rows.map((r) => r.scope)).toEqual(["ask", "daily"]);
    expect(rows[0].variant).toBe("q1");
  });

  it("scope is constrained to the three shipped scopes", async () => {
    await expect(
      asServiceRole(sql, (tx) =>
        tx`insert into ai_narratives ${tx({ ...narrativeRow(A), scope: "year" }, "user_id", "scope", "for_date", "narrative", "model_name", "model_version", "prompt_version", "facts_digest")}`,
      ),
    ).rejects.toThrow();
  });
});
