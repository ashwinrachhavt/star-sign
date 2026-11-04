/**
 * Social-loop DB tests (W2 friend updates + add-by-handle).
 *
 * Real-Postgres harness: the policies and triggers under test are the
 * ones that run in production. Covers:
 *   0014 handles — auto-assignment, format CHECK, uniqueness, own-row-only
 *   0015 grants  — start off, recorded at acceptance, owner-only flips,
 *                  never introduced on a non-accepted row, and the
 *                  unchanged-grant illegal transition still owned by the
 *                  0006 transition trigger (trigger-ordering regression)
 *   visibility   — granted → grant column flips off → the update hides;
 *                  revoked → the row leaves the accepted set; raw birth
 *                  rows NEVER cross RLS, even fully connected + granted
 */
import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import {
  applyMigrations,
  asServiceRole,
  asUser,
  createHarnessDb,
  testUsers,
  type TestDb,
} from "./harness";

const A = testUsers.a;
const B = testUsers.b;

async function seedProfile(sql: TestDb, id: string, name: string) {
  await sql`insert into auth.users (id) values (${id}) on conflict do nothing`;
  await sql`insert into profiles (id, display_name) values (${id}, ${name}) on conflict do nothing`;
}

async function seedBirthProfile(sql: TestDb, id: string) {
  await sql`insert into birth_profiles (user_id, birth_date, birth_time_precision, birth_time_zone, birth_lat, birth_lon)
            values (${id}, '1991-01-02', 'exact', 'Europe/London', 51.5, -0.1)`;
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

async function acceptConnection(sql: TestDb, connectionId: string) {
  await asUser(sql, B, (tx) =>
    tx`update connections set state = 'accepted', responded_at = now() where id = ${connectionId}`,
  );
}

describe("social loop: handles, daily-update grants, visibility (W2)", () => {
  let sql: TestDb;

  beforeAll(async () => {
    sql = await createHarnessDb();
    await applyMigrations(sql);
    await seedProfile(sql, A, "A Person");
    await seedProfile(sql, B, "B Person");
  });

  afterAll(async () => {
    await sql.end();
  });

  beforeEach(async () => {
    await sql`truncate connections, connection_state_log`;
  });

  describe("0014 handles", () => {
    it("auto-assigns a handle to every profile (INSERT trigger)", async () => {
      const rows = await sql`select id, handle from profiles where id in (${A}, ${B})`;
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.handle).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);
      }
      // Uniqueness across the two seeded profiles.
      expect(rows[0].handle).not.toBe(rows[1].handle);
    });

    it("rejects handles outside the format CHECK", async () => {
      await expect(
        asUser(sql, A, (tx) => tx`update profiles set handle = 'Bad_Handle!' where id = ${A}`),
      ).rejects.toThrow();
      await expect(
        asUser(sql, A, (tx) => tx`update profiles set handle = '-leading' where id = ${A}`),
      ).rejects.toThrow();
    });

    it("rejects duplicate handles (unique index)", async () => {
      const [a] = await sql`select handle from profiles where id = ${A}`;
      await expect(
        asUser(sql, B, (tx) =>
          tx`update profiles set handle = ${a.handle} where id = ${B}`,
        ),
      ).rejects.toThrow();
    });

    it("a user edits only their own handle (RLS: cross-user update is a no-op)", async () => {
      await asUser(sql, A, async (tx) => {
        const rows = await tx`update profiles set handle = 'a-person-test' where id = ${A} returning id`;
        expect(rows).toHaveLength(1);
      });
      // A targeting B's row: visible rows are A's own only → zero updates.
      await asUser(sql, A, async (tx) => {
        const rows = await tx`update profiles set handle = 'hijacked' where id = ${B} returning id`;
        expect(rows).toHaveLength(0);
      });
      const [b] = await sql`select handle from profiles where id = ${B}`;
      expect(b.handle).not.toBe("hijacked");
    });
  });

  describe("0015 daily-updates grant", () => {
    it("starts off: INSERT with grants set is rejected", async () => {
      await expect(
        asUser(sql, A, (tx) =>
          tx`insert into connections (requester_id, addressee_id, state, daily_updates_requester)
             values (${A}, ${B}, 'requested', true)`,
        ),
      ).rejects.toThrow(/daily-update grants start off/);
    });

    it("cannot be introduced while the connection is still requested", async () => {
      const id = await requestConnection(sql, A, B);
      await expect(
        asUser(sql, A, (tx) =>
          tx`update connections set daily_updates_requester = true where id = ${id}`,
        ),
      ).rejects.toThrow(/daily-update grants apply only to accepted connections/);
    });

    it("acceptance records the product default both ways", async () => {
      const id = await requestConnection(sql, A, B);
      await acceptConnection(sql, id);
      const [row] = await sql`select daily_updates_requester, daily_updates_addressee
                              from connections where id = ${id}`;
      expect(row.daily_updates_requester).toBe(true);
      expect(row.daily_updates_addressee).toBe(true);
    });

    it("after acceptance each party flips ONLY their own column", async () => {
      const id = await requestConnection(sql, A, B);
      await acceptConnection(sql, id);

      // A (requester) flips their own grant off.
      await asUser(sql, A, (tx) =>
        tx`update connections set daily_updates_requester = false where id = ${id}`,
      );
      const [afterA] = await sql`select daily_updates_requester, daily_updates_addressee
                                 from connections where id = ${id}`;
      expect(afterA.daily_updates_requester).toBe(false);
      expect(afterA.daily_updates_addressee).toBe(true);

      // A flipping B's column is rejected; service role too (consent acts
      // are session-bound).
      await expect(
        asUser(sql, A, (tx) =>
          tx`update connections set daily_updates_addressee = false where id = ${id}`,
        ),
      ).rejects.toThrow(/only the addressee can change/);
      await expect(
        asServiceRole(sql, (tx) =>
          tx`update connections set daily_updates_addressee = false where id = ${id}`,
        ),
      ).rejects.toThrow(/only the addressee can change/);
    });

    it("REGRESSION: an unchanged-grant illegal transition stays the transition trigger's error", async () => {
      const id = await requestConnection(sql, A, B);
      await acceptConnection(sql, id);
      // BEFORE triggers fire alphabetically (this guard first); a grant
      // leak there would shadow the 0006 state-machine error.
      await expect(
        asUser(sql, B, (tx) => tx`update connections set state = 'requested' where id = ${id}`),
      ).rejects.toThrow(/invalid transition accepted -> requested/);
    });
  });

  describe("friend-update visibility", () => {
    it("ungranted → hidden: the grant column is what the feed reads", async () => {
      const id = await requestConnection(sql, A, B);
      await acceptConnection(sql, id);
      // B (addressee) withdraws their sharing; A's own grant stays on.
      await asUser(sql, B, (tx) =>
        tx`update connections set daily_updates_addressee = false where id = ${id}`,
      );
      const [row] = await sql`select daily_updates_requester, daily_updates_addressee, state
                              from connections where id = ${id}`;
      // The route derives A's feed from B's grant (the OTHER party's
      // column) → false = B's update hidden from A, A's still visible to B.
      expect(row.state).toBe("accepted");
      expect(row.daily_updates_addressee).toBe(false);
      expect(row.daily_updates_requester).toBe(true);
    });

    it("revoked → the connection leaves the accepted set immediately", async () => {
      const id = await requestConnection(sql, A, B);
      await acceptConnection(sql, id);
      await asUser(sql, B, (tx) =>
        tx`update connections set state = 'disconnected', ended_at = now() where id = ${id}`,
      );
      const [row] = await sql`select state from connections where id = ${id}`;
      expect(row.state).toBe("disconnected");
    });

    it("raw birth rows never cross RLS — even connected and granted", async () => {
      await seedBirthProfile(sql, B);
      const id = await requestConnection(sql, A, B);
      await acceptConnection(sql, id);
      // Grants both on (acceptance default): the friend update is visible.
      const [row] = await sql`select daily_updates_addressee from connections where id = ${id}`;
      expect(row.daily_updates_addressee).toBe(true);
      // Yet A's session reads zero of B's birth rows — the feed renders
      // only the server-derived allowlist projection.
      await asUser(sql, A, async (tx) => {
        const rows = await tx`select * from birth_profiles where user_id = ${B}`;
        expect(rows).toHaveLength(0);
      });
      // The service role (the derivation's boundary) sees exactly one.
      const serviceRows = await asServiceRole(sql, (tx) =>
        tx`select * from birth_profiles where user_id = ${B}`,
      );
      expect(serviceRows).toHaveLength(1);
    });
  });
});
