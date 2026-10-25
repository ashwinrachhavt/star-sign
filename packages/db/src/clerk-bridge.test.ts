/**
 * Clerk identity bridge — RLS integration tests (ASH-231 criterion 3).
 *
 * Proves the migration-0007 mapping preserves per-user isolation: after
 * mapping Clerk subjects to profile UUIDs, auth.uid()-based RLS still
 * separates users (A cannot touch B's rows), and the mapping column is
 * unique + nullable (no lockout for pre-existing rows).
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  applyMigrations,
  asAnon,
  asUser,
  createHarnessDb,
  testUsers,
  type TestDb,
} from "./harness.js";

const A = testUsers.a;
const B = testUsers.b;

const CLERK_SUBJ_A = "user_2abcSupabasePasswordUser000000";
const CLERK_SUBJ_B = "user_2defClerkBridgedUser00000001";

let sql: TestDb;

beforeAll(async () => {
  sql = await createHarnessDb();
  await applyMigrations(sql);
  // Seed the pre-existing users (auth + profiles), as the local stack has.
  await sql`insert into auth.users (id) values (${A}), (${B}) on conflict do nothing`;
  await sql`insert into profiles (id) values (${A}), (${B}) on conflict do nothing`;
});

afterAll(async () => {
  await sql.end();
});

describe("clerk identity bridge (migration 0007)", () => {
  it("backfill safety: existing profiles survive with null clerk_subject (no lockout)", async () => {
    const rows = await sql`
      select id, clerk_subject from profiles where id in (${A}, ${B})`;
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.clerk_subject).toBeNull();
    // And those users can still read their own rows via RLS.
    const own = await asUser(sql, A, (tx) =>
      tx`select id from profiles where id = ${A}`,
    );
    expect(own).toHaveLength(1);
  });

  it("mapping a Clerk subject to a profile works and is unique", async () => {
    await sql`update profiles set clerk_subject = ${CLERK_SUBJ_A} where id = ${A}`;

    const found = await sql`
      select id from profiles where clerk_subject = ${CLERK_SUBJ_A}`;
    expect(found[0].id).toBe(A);

    // A second profile cannot claim the same subject.
    await sql`insert into auth.users (id) values (${testUsers.b}) on conflict do nothing`;
    await expect(
      sql`update profiles set clerk_subject = ${CLERK_SUBJ_A} where id = ${B}`,
    ).rejects.toThrow(/duplicate key|unique constraint/i);
  });

  it("criterion 3: auth.uid() RLS still isolates users after mapping (A cannot touch B's rows)", async () => {
    // Give B a birth profile (owned row).
    await asUser(sql, B, (tx) =>
      tx`
        insert into birth_profiles (user_id, birth_date, birth_time_precision, birth_time_zone, birth_lat, birth_lon)
        values (${B}, '1985-11-30', 'exact', 'Asia/Kolkata', 19.076, 72.8777)`,
    );

    // Map B's subject (as the bridge would post-sign-in).
    await sql`update profiles set clerk_subject = ${CLERK_SUBJ_B} where id = ${B}`;

    // A (mapped to A's subject) cannot see or mutate B's birth profile.
    const aSeesB = await asUser(sql, A, (tx) =>
      tx`select user_id from birth_profiles where user_id = ${B}`,
    );
    expect(aSeesB).toHaveLength(0);

    // A's update silently affects 0 rows (RLS USING filter).
    await asUser(sql, A, (tx) =>
      tx`delete from birth_profiles where user_id = ${B}`,
    );
    const bStillThere = await asUser(sql, B, (tx) =>
      tx`select user_id from birth_profiles where user_id = ${B}`,
    );
    expect(bStillThere).toHaveLength(1);

    // B still sees their own row through their own session.
    expect(bStillThere[0].user_id).toBe(B);
  });

  it("anon cannot use the mapping to escalate (fail closed)", async () => {
    const rows = await asAnon(sql, (tx) =>
      tx`select id from profiles where clerk_subject = ${CLERK_SUBJ_A}`,
    );
    expect(rows).toHaveLength(0);
  });

  it("clerk_subject column accepts the Clerk subject format (text, no constraint drift)", async () => {
    // Real Clerk subjects are user_<random>; a text column must take them.
    // auth.users insert auto-creates the profile (migration 0001 trigger),
    // so mapping is a pure UPDATE — mirroring resolveActor's contract.
    const weird = "user_2vJ8Kc9dEfGhIjKlMnOpQrStUvW";
    const fresh = crypto.randomUUID();
    await sql`insert into auth.users (id) values (${fresh})`;
    await sql`update profiles set clerk_subject = ${weird} where id = ${fresh}`;
    const rows = await sql`select clerk_subject from profiles where clerk_subject = ${weird}`;
    expect(rows).toHaveLength(1);
    await sql`delete from profiles where id = ${fresh}`;
    await sql`delete from auth.users where id = ${fresh}`;
  });
});

describe("account deletion cascade (ASH-231 criterion 4)", () => {
  it("deleting the profile cascades through all owned tables; login after deletion is fresh", async () => {
    const U = crypto.randomUUID();
    await sql`insert into auth.users (id) values (${U})`; // trigger creates profile

    await asUser(sql, U, (tx) =>
      tx`
        insert into birth_profiles (user_id, birth_date, birth_time_precision, birth_time_zone, birth_lat, birth_lon)
        values (${U}, '1990-06-15', 'exact', 'America/New_York', 40.7128, -74.006)`,
    );
    await asUser(sql, U, (tx) =>
      tx`insert into people (owner_id, display_name) values (${U}, 'someone')`,
    );
    await asUser(sql, U, (tx) =>
      tx`insert into reflections (user_id, for_date, body) values (${U}, '2026-10-25', 'note')`,
    );

    // Owned rows exist pre-deletion.
    const peoplePre = await asUser(sql, U, (tx) =>
      tx`select count(*)::int as n from people where owner_id = ${U}`);
    expect(peoplePre[0].n).toBe(1);

    // Hard delete: removing the auth user cascades to profiles (FK on
    // delete cascade), which cascades through every owned table. This
    // mirrors production: account deletion removes the identity row.
    await sql`delete from auth.users where id = ${U}`;

    const counts = {
      profiles: await sql`select count(*)::int as n from profiles where id = ${U}`,
      birth: await sql`select count(*)::int as n from birth_profiles where user_id = ${U}`,
      people: await sql`select count(*)::int as n from people where owner_id = ${U}`,
      readings: await sql`select count(*)::int as n from daily_readings where user_id = ${U}`,
      reflections: await sql`select count(*)::int as n from reflections where user_id = ${U}`,
    };
    for (const [, rows] of Object.entries(counts)) {
      expect(rows[0].n).toBe(0);
    }

    // A fresh signup with the same id starts clean (login-after-deletion
    // = fresh account): trigger re-provisions an empty profile.
    await sql`insert into auth.users (id) values (${U})`;
    const freshProfile = await sql`select display_name from profiles where id = ${U}`;
    expect(freshProfile).toHaveLength(1);
    const peoplePost = await sql`select count(*)::int as n from people where owner_id = ${U}`;
    expect(peoplePost[0].n).toBe(0);
    await sql`delete from profiles where id = ${U}`;
    await sql`delete from auth.users where id = ${U}`;
  });
});
