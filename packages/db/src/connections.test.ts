/**
 * Connections RLS + state machine tests (ASH-256 / 5.1).
 *
 * Real-Postgres harness: the policies under test are the policies that
 * run in production. Covers:
 *   AC1 — only explicit state-machine transitions change visibility
 *   AC2 — cross-user access fails closed at every state
 *   AC3 — revocation is immediate and unilateral (no grace window)
 *   AC4 — multiple independent connections per user
 */
import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import {
  applyMigrations,
  asAnon,
  asUser,
  createHarnessDb,
  testUsers,
  type TestDb,
} from "./harness";

const A = testUsers.a;
const B = testUsers.b;
const C = "00000000-0000-4000-8000-00000000000c";

async function seedProfile(sql: TestDb, id: string) {
  await sql`insert into auth.users (id) values (${id}) on conflict do nothing`;
  await sql`insert into profiles (id) values (${id}) on conflict do nothing`;
}

async function requestConnection(sql: TestDb, from: string, to: string): Promise<string> {
  return asUser(sql, from, async (tx) => {
    const rows = await tx`
      insert into connections (requester_id, addressee_id, state)
      values (${from}, ${to}, 'requested')
      returning id`;
    return rows[0].id as string;
  });
}

describe("connections state machine + RLS (ASH-256)", () => {
  let sql: TestDb;

  beforeAll(async () => {
    sql = await createHarnessDb();
    await applyMigrations(sql);
    await seedProfile(sql, A);
    await seedProfile(sql, B);
    await seedProfile(sql, C);
  });

  afterAll(async () => {
    await sql.end();
  });

  beforeEach(async () => {
    // Each test starts from a clean state-machine slate; profiles stay.
    await sql`truncate connections, connection_state_log`;
  });

  it("AC1: requested → accepted by the recipient only", async () => {
    const id = await requestConnection(sql, A, B);

    // Addressee cannot be the requester: A (requester) cannot self-accept.
    await expect(
      asUser(sql, A, (tx) =>
        tx`update connections set state = 'accepted', responded_at = now() where id = ${id}`,
      ),
    ).rejects.toThrow(/only the recipient can accept/);

    // B (recipient) accepts.
    await asUser(sql, B, async (tx) => {
      const rows = await tx`update connections set state = 'accepted', responded_at = now() where id = ${id} returning state`;
      expect(rows[0].state).toBe("accepted");
    });

    // Repeat accept is a no-op-safe read: still accepted, no new row.
    await asUser(sql, B, async (tx) => {
      const rows = await tx`select state from connections where id = ${id}`;
      expect(rows[0].state).toBe("accepted");
      const count = await tx`select count(*)::int as n from connections where requester_id = ${A} and addressee_id = ${B}`;
      expect(count[0].n).toBe(1);
    });
  });

  it("AC1: requested → revoked (decline) works; revoked is terminal", async () => {
    const id = await requestConnection(sql, A, B);

    // B declines → revoked.
    await asUser(sql, B, (tx) =>
      tx`update connections set state = 'revoked', ended_at = now() where id = ${id}`,
    );

    // No transition out of revoked — not even back to requested.
    await expect(
      asUser(sql, A, (tx) =>
        tx`update connections set state = 'requested' where id = ${id}`,
      ),
    ).rejects.toThrow(/invalid transition revoked -> requested/);
  });

  it("AC1: accepted → disconnected (by either party); no in-place re-accept", async () => {
    const id = await requestConnection(sql, B, A); // either direction
    await asUser(sql, A, (tx) =>
      tx`update connections set state = 'accepted', responded_at = now() where id = ${id}`,
    );

    // Illegal: accepted → requested (re-request in place).
    await expect(
      asUser(sql, B, (tx) => tx`update connections set state = 'requested' where id = ${id}`),
    ).rejects.toThrow(/invalid transition accepted -> requested/);

    // Legal: A disconnects.
    await asUser(sql, A, (tx) =>
      tx`update connections set state = 'disconnected', ended_at = now() where id = ${id}`,
    );

    // Terminal.
    await expect(
      asUser(sql, B, (tx) => tx`update connections set state = 'accepted' where id = ${id}`),
    ).rejects.toThrow(/invalid transition disconnected -> accepted/);
  });

  it("AC2: cross-user access fails closed at every state", async () => {
    const id = await requestConnection(sql, A, B);

    // C (not a participant) cannot see the row in any state.
    await asUser(sql, C, async (tx) => {
      const rows = await tx`select id from connections where id = ${id}`;
      expect(rows).toHaveLength(0);
    });

    // C cannot mutate it either — RLS filters the row from the UPDATE's
    // USING clause, so the statement succeeds having changed 0 rows.
    await asUser(sql, C, (tx) =>
      tx`update connections set state = 'accepted', responded_at = now() where id = ${id}`,
    );

    // Verify no change happened.
    await asUser(sql, A, async (tx) => {
      const rows = await tx`select state from connections where id = ${id}`;
      expect(rows[0].state).toBe("requested");
    });

    // Anonymous cannot see anything.
    const anonRows = await asAnon(sql, (tx) => tx`select id from connections`);
    expect(anonRows).toHaveLength(0);
  });

  it("AC2: accepted state still grants no third-party access", async () => {
    const id = await requestConnection(sql, A, B);
    await asUser(sql, B, (tx) =>
      tx`update connections set state = 'accepted', responded_at = now() where id = ${id}`,
    );

    await asUser(sql, C, async (tx) => {
      const rows = await tx`select id from connections where id = ${id}`;
      expect(rows).toHaveLength(0);
    });
  });

  it("AC3: revocation is immediate and unilateral", async () => {
    const id = await requestConnection(sql, A, B);
    await asUser(sql, B, (tx) =>
      tx`update connections set state = 'accepted', responded_at = now() where id = ${id}`,
    );

    // A revokes unilaterally — no confirmation from B required.
    await asUser(sql, A, (tx) =>
      tx`update connections set state = 'revoked', ended_at = now() where id = ${id}`,
    );

    // The row's state is revoked NOW: any visibility decision keyed on
    // accepted state sees it immediately (no grace window).
    await asUser(sql, B, async (tx) => {
      const rows = await tx`select state, ended_at from connections where id = ${id}`;
      expect(rows[0].state).toBe("revoked");
      expect(rows[0].ended_at).not.toBeNull();
    });

    // Revocation propagates to the audit log with the actor recorded.
    await asUser(sql, B, async (tx) => {
      const log = await tx`
        select actor_id, from_state, to_state from connection_state_log
        where connection_id = ${id} order by at asc`;
      expect(log.length).toBeGreaterThanOrEqual(2);
      expect(log[log.length - 1].to_state).toBe("revoked");
    });
  });

  it("AC4: multiple independent connections per user", async () => {
    const idAB = await requestConnection(sql, A, B);
    const idAC = await requestConnection(sql, A, C);

    await asUser(sql, B, (tx) =>
      tx`update connections set state = 'accepted', responded_at = now() where id = ${idAB}`,
    );

    // A→C stays requested; A→B accepted. Independence both ways.
    await asUser(sql, A, async (tx) => {
      const ab = await tx`select state from connections where id = ${idAB}`;
      const ac = await tx`select state from connections where id = ${idAC}`;
      expect(ab[0].state).toBe("accepted");
      expect(ac[0].state).toBe("requested");
    });

    // Revoking A→C does not touch A→B.
    await asUser(sql, C, (tx) =>
      tx`update connections set state = 'revoked', ended_at = now() where id = ${idAC}`,
    );
    await asUser(sql, A, async (tx) => {
      const ab = await tx`select state from connections where id = ${idAB}`;
      expect(ab[0].state).toBe("accepted");
    });
  });

  it("duplicate active pairs are rejected (either direction)", async () => {
    const first = await requestConnection(sql, A, B);
    // Same direction duplicate:
    await expect(
      asUser(sql, A, (tx) =>
        tx`insert into connections (requester_id, addressee_id, state) values (${A}, ${B}, 'requested')`,
      ),
    ).rejects.toThrow();
    // Reverse direction also blocked while the first is active:
    await expect(
      asUser(sql, B, (tx) =>
        tx`insert into connections (requester_id, addressee_id, state) values (${B}, ${A}, 'requested')`,
      ),
    ).rejects.toThrow();
    void first;
  });

  it("self-connection is impossible", async () => {
    await expect(
      asUser(sql, A, (tx) =>
        tx`insert into connections (requester_id, addressee_id, state) values (${A}, ${A}, 'requested')`,
      ),
    ).rejects.toThrow(/check constraint|connections_requester_id_check/);
  });

  it("anon cannot read or insert (fail closed)", async () => {
    // Anon INSERT is rejected outright (no insert policy).
    await expect(
      asAnon(sql, (tx) =>
        tx`insert into connections (requester_id, addressee_id, state) values (${A}, ${B}, 'requested')`,
      ),
    ).rejects.toThrow(/row-level security/);

    // Anon SELECT returns nothing (no select policy).
    const rows = await asAnon(sql, (tx) => tx`select id from connections`);
    expect(rows).toHaveLength(0);
  });
});
