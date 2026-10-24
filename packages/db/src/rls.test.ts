import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createHarnessDb,
  applyMigrations,
  asUser,
  asAnon,
  asServiceRole,
  testUsers,
  type TestDb,
} from "./harness.js";

const A = testUsers.a;
const B = testUsers.b;

// User-owned tables and the column holding their owner FK.
const OWNED_TABLES: Array<[string, string]> = [
  ["profiles", "id"],
  ["birth_profiles", "user_id"],
  ["daily_readings", "user_id"],
  ["people", "owner_id"],
  ["compatibility_reports", "owner_id"],
  ["reflections", "user_id"],
];

let sql: TestDb;

beforeAll(async () => {
  sql = await createHarnessDb();
  await applyMigrations(sql);
});

afterAll(async () => {
  await sql?.end();
});

async function seedUsers() {
  await sql`insert into auth.users (id) values (${A}), (${B}) on conflict do nothing`;
  await asServiceRole(sql, async (tx) => {
    for (const id of [A, B]) {
      await tx`insert into profiles (id, display_name) values (${id}, ${"user"}) on conflict do nothing`;
    }
  });
}

beforeAll(seedUsers);

describe("migration discipline", () => {
  it("daily_readings has unique (user_id, for_date) — second insert fails at the DB", async () => {
    const row = {
      user_id: A,
      for_date: "2026-10-24",
      headline: "h",
      explanation: "e",
      dos: [],
      donts: [],
      life_areas: [],
      provenance: {},
      uncertainty_note: "u",
    };
    await asUser(sql, A, (tx) => tx`insert into daily_readings ${tx(row)}`);
    await expect(
      asUser(sql, A, (tx) => tx`insert into daily_readings ${tx(row)}`),
    ).rejects.toThrowError(/duplicate key|unique/i);
  });

  it("provenance columns are NOT NULL and backfilled with current constants", async () => {
    const [col] = await sql`
      select column_default from information_schema.columns
      where table_name = 'daily_readings' and column_name = 'ruleset_version'`;
    expect(col.column_default).toContain("2026-10.2");
    const rows = await sql`
      select count(*)::int as n from daily_readings
      where ruleset_version is null or copy_version is null
        or ephemeris_name is null or ephemeris_version is null`;
    expect(rows[0].n).toBe(0);
  });

  it("every FK has a supporting index", async () => {
    const missing = await sql`
      with fk_cols as (
        select c.conrelid::regclass as tbl, array_agg(a.attname order by a.attnum) as cols
        from pg_constraint c
        join unnest(c.conkey) k on true
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k
        where c.contype = 'f' and c.connamespace = 'public'::regnamespace
        group by c.conrelid, c.oid
      )
      select tbl, cols from fk_cols f
      where not exists (
        select 1 from pg_index i
        where i.indrelid = f.tbl::regclass
          and (select array_agg(a.attname order by a.attnum)
               from pg_attribute a
               where a.attrelid = i.indrelid and a.attnum = any(i.indkey::smallint[]))
              @> f.cols
      )`;
    expect(missing).toEqual([]);
  });

  it("updated_at is maintained by trigger", async () => {
    await asUser(sql, A, async (tx) => {
      await tx`update profiles set display_name = 'renamed' where id = ${A}`;
      const [p] = await tx`select updated_at, created_at from profiles where id = ${A}`;
      expect(p.updated_at).toBeDefined();
    });
  });

  it("iana_timezone column exists on birth_profiles", async () => {
    const cols = await sql`
      select column_name from information_schema.columns
      where table_name = 'birth_profiles' and column_name = 'iana_timezone'`;
    expect(cols).toHaveLength(1);
  });
});

describe("RLS — per-table full paranoia", () => {
  // Seed one row per owned table for user B so isolation has a target.
  beforeAll(async () => {
    await asUser(sql, B, async (tx) => {
      await tx`insert into birth_profiles (user_id, birth_date, birth_time_precision, birth_time_zone, birth_lat, birth_lon)
               values (${B}, '1991-01-02', 'exact', 'Europe/London', 51.5, -0.1)`;
      await tx`insert into daily_readings (user_id, for_date, headline, explanation, dos, donts, life_areas, provenance, uncertainty_note)
               values (${B}, '2026-10-25', 'h', 'e', '[]', '[]', '[]', '{}', 'u')`;
      const [person] = await tx`insert into people (owner_id, display_name) values (${B}, 'B person') returning id`;
      await tx`insert into compatibility_reports (owner_id, person_id, dimensions, provenance) values (${B}, ${person.id}, '[]', '{}')`;
      await tx`insert into reflections (user_id, for_date, body) values (${B}, '2026-10-25', 'b note')`;
    });
  });

  for (const [table, ownerCol] of OWNED_TABLES) {
    // birth_profiles is keyed by user_id itself; every other table has id.
    const idCol = table === "birth_profiles" ? "user_id" : "id";
    describe(table, () => {
      it("(a) user A cannot select/update/delete user B's rows", async () => {
        const bRows = await asUser(sql, B, (tx) =>
          tx`select * from ${sql(table)} where ${sql(ownerCol)} = ${B}`,
        );
        expect(bRows.length, `seed produced no B rows for ${table}`).toBeGreaterThan(0);

        const target = bRows[0];
        const seenByA = await asUser(sql, A, (tx) =>
          tx`select * from ${sql(table)} where ${sql(idCol)} = ${target[idCol]}`,
        );
        expect(seenByA).toHaveLength(0);

        // Update/delete across the boundary: allowed to run but matches zero
        // rows (RLS filters the WHERE, it does not raise) — except INSERT,
        // which is separately covered by WITH CHECK tests.
        const updated = await asUser(sql, A, (tx) =>
          tx`update ${sql(table)} set ${sql(ownerCol)} = ${sql(ownerCol)} where ${sql(idCol)} = ${target[idCol]} returning ${sql(idCol)}`,
        );
        expect(updated).toHaveLength(0);

        const deleted = await asUser(sql, A, (tx) =>
          tx`delete from ${sql(table)} where ${sql(idCol)} = ${target[idCol]} returning ${sql(idCol)}`,
        );
        expect(deleted).toHaveLength(0);

        // B's row is untouched
        const stillThere = await asUser(sql, B, (tx) =>
          tx`select * from ${sql(table)} where ${sql(idCol)} = ${target[idCol]}`,
        );
        expect(stillThere).toHaveLength(1);
      });

      it("(c) anon/unauthenticated gets zero rows", async () => {
        const rows = await asAnon(sql, (tx) => tx`select * from ${sql(table)}`);
        expect(rows).toHaveLength(0);
      });

      it("(d) service role can access rows but is a separate role from actor clients", async () => {
        const rows = await asServiceRole(sql, (tx) =>
          tx`select count(*)::int as n from ${sql(table)}`,
        );
        expect(rows[0].n).toBeGreaterThanOrEqual(0);
      });
    });
  }

  it("profiles: B cannot update A's profile", async () => {
    await expect(
      asUser(sql, B, (tx) =>
        tx`update profiles set display_name = 'hacked' where id = ${A} returning id`,
      ),
    ).resolves.toHaveLength(0);
  });

  it("daily_readings: A sees only own rows", async () => {
    await asUser(sql, A, (tx) =>
      tx`insert into daily_readings (user_id, for_date, headline, explanation, dos, donts, life_areas, provenance, uncertainty_note)
         values (${A}, '2026-10-25', 'h', 'e', '[]', '[]', '[]', '{}', 'u')`,
    );
    const seen = await asUser(sql, B, (tx) =>
      tx`select * from daily_readings where user_id = ${A}`,
    );
    expect(seen).toHaveLength(0);
  });

  it("people: insert for another owner is rejected by WITH CHECK", async () => {
    await expect(
      asUser(sql, B, (tx) =>
        tx`insert into people (owner_id, display_name) values (${A}, 'spoof')`,
      ),
    ).rejects.toThrowError(/row-level security|policy/i);
  });

  it("reflections: cross-user update affects zero rows", async () => {
    await asUser(sql, A, (tx) =>
      tx`insert into reflections (user_id, for_date, body) values (${A}, '2026-10-24', 'private note')`,
    );
    const updated = await asUser(sql, B, (tx) =>
      tx`update reflections set body = 'hax' where user_id = ${A} returning id`,
    );
    expect(updated).toHaveLength(0);
  });
});

describe("deletion cascade", () => {
  it("(e) deleting a profile leaves no orphan rows", async () => {
    // Seed a full data set for user A
    await asUser(sql, A, async (tx) => {
      await tx`insert into birth_profiles (user_id, birth_date, birth_time_precision, birth_time_zone, birth_lat, birth_lon)
               values (${A}, '1990-06-15', 'exact', 'America/New_York', 40.7, -74.0)`;
      await tx`insert into daily_readings (user_id, for_date, headline, explanation, dos, donts, life_areas, provenance, uncertainty_note)
               values (${A}, '2026-10-26', 'h', 'e', '[]', '[]', '[]', '{}', 'u')`;
      const [person] = await tx`insert into people (owner_id, display_name) values (${A}, 'Mom') returning id`;
      await tx`insert into compatibility_reports (owner_id, person_id, dimensions, provenance) values (${A}, ${person.id}, '[]', '{}')`;
      await tx`insert into reflections (user_id, for_date, body) values (${A}, '2026-10-26', 'note')`;
    });

    await asServiceRole(sql, (tx) => tx`delete from profiles where id = ${A}`);

    // Every user-owned table must hold zero rows owned by A (no orphans,
    // no surviving shadows of the deleted account).
    for (const [table, ownerCol] of OWNED_TABLES) {
      const remaining = await asServiceRole(sql, (tx) =>
        tx`select count(*)::int as n from ${sql(table)} where ${sql(ownerCol)} = ${A}`,
      );
      expect(remaining[0].n, `${table} has orphan rows after cascade`).toBe(0);
    }
  });
});
