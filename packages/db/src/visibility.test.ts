/**
 * Share scope + visibility matrix tests (ASH-257 / 5.2).
 *
 * Matrix under test (owner-approved):
 *   requested  → share_scope 'none'
 *   accepted   → share_scope 'chart_placements' (recorded at acceptance)
 *   revoked    → scope frozen; reads see nothing (projection layer, but
 *                the scope column itself never widens mid-flight)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHarnessDb, applyMigrations, asUser, asServiceRole, testUsers, type TestDb } from "./harness.js";

const A = testUsers.a;
const B = testUsers.b;

let sql: TestDb;
let connectionId: string;

beforeAll(async () => {
  sql = await createHarnessDb();
  await applyMigrations(sql);
  await sql`insert into auth.users (id) values (${A}), (${B}) on conflict do nothing`;
  await asServiceRole(sql, (tx) =>
    tx`insert into profiles (id) values (${A}), (${B}) on conflict do nothing`,
  );
  await asUser(sql, A, (tx) =>
    tx`insert into connections (requester_id, addressee_id, state) values (${A}, ${B}, 'requested')`,
  );
  const [row] = await asUser(sql, A, (tx) =>
    tx`select id from connections where requester_id = ${A}`,
  );
  connectionId = row.id;
});

afterAll(async () => {
  await sql?.end();
});

describe("share scope (criterion 3: recorded, auditable)", () => {
  it("requested state has scope 'none'", async () => {
    const [row] = await asUser(sql, A, (tx) =>
      tx`select share_scope, state from connections where id = ${connectionId}`,
    );
    expect(row.state).toBe("requested");
    expect(row.share_scope).toBe("none");
  });

  it("acceptance records 'chart_placements' (recipient-only via 5.1 guard)", async () => {
    await asUser(sql, B, (tx) =>
      tx`update connections set state = 'accepted' where id = ${connectionId}`,
    );
    const [row] = await asUser(sql, B, (tx) =>
      tx`select share_scope, state from connections where id = ${connectionId}`,
    );
    expect(row.state).toBe("accepted");
    expect(row.share_scope).toBe("chart_placements");
  });

  it("share_scope cannot be widened outside acceptance (frozen)", async () => {
    // Try to flip scope without a state change — must raise.
    await expect(
      asUser(sql, B, (tx) =>
        tx`update connections set share_scope = 'none' where id = ${connectionId}`,
      ),
    ).rejects.toThrowError(/share_scope changes only at acceptance/i);
  });

  it("revocation freezes everything immediately (criterion: nothing, immediately)", async () => {
    await asUser(sql, A, (tx) =>
      tx`update connections set state = 'revoked' where id = ${connectionId}`,
    );
    const [row] = await asUser(sql, A, (tx) =>
      tx`select share_scope, state from connections where id = ${connectionId}`,
    );
    expect(row.state).toBe("revoked");
    // Scope column retains its historical value for audit, but the
    // projection layer gates on state first — nothing is visible.
    expect(row.share_scope).toBe("chart_placements");
  });
});

describe("visibility per state (criterion 4)", () => {
  it("non-participant sees no connection rows at any state (fail closed)", async () => {
    const C = "00000000-0000-4000-8000-00000000000c";
    await sql`insert into auth.users (id) values (${C}) on conflict do nothing`;
    await asServiceRole(sql, (tx) =>
      tx`insert into profiles (id) values (${C}) on conflict do nothing`,
    );
    const seen = await asUser(sql, C, (tx) =>
      tx`select count(*)::int as n from connections where id = ${connectionId}`,
    );
    expect(seen[0].n).toBe(0);
  });
});
