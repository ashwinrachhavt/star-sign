/**
 * RLS v3 — ownership resolved through profiles.clerk_subject (W1).
 *
 * The Clerk path end to end at the data layer: a session whose JWT sub
 * is a Clerk subject resolves to exactly one profile, every actor-owned
 * table isolates users across that identity, the connection state
 * machine (guards + audit actor) works under Clerk subjects, and
 * revocation removes the accepted-state precondition the partner
 * chart/report/update routes 404 on.
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  applyMigrations,
  asAnon,
  asUser,
  asServiceRole,
  createHarnessDb,
  type TestDb,
} from "./harness.js";

let sql: TestDb;

// Real Clerk subjects are user_<base62>; these mirror that shape.
const SUBJECT_A = "user_2rlsV3SubjectA0000000000000000a";
const SUBJECT_B = "user_2rlsV3SubjectB0000000000000000b";
const SUBJECT_C = "user_2rlsV3SubjectC0000000000000000c";
const SUBJECT_D = "user_2rlsV3SubjectD0000000000000000d";

let profileA: string;
let profileB: string;
let profileC: string;
let profileD: string;

/**
 * Mirrors provisionClerkProfileViaSql's contract: anchor one auth.users
 * row (the signup trigger creates the profile), then map the Clerk
 * subject onto it with auth_provider 'clerk'. Hosted auth.users has no
 * id default, so the anchor supplies one explicitly.
 */
async function provisionBySubject(
  subject: string,
  email: string,
): Promise<string> {
  const [anchor] = await sql`
    insert into auth.users (id, email, raw_user_meta_data)
    values (gen_random_uuid(), ${email},
            ${JSON.stringify({ provider: "clerk", display_name: email })}::jsonb)
    returning id`;
  const [profile] = await sql`
    update profiles set clerk_subject = ${subject}, auth_provider = 'clerk'
    where id = ${anchor.id} returning id`;
  return profile.id as string;
}

beforeAll(async () => {
  sql = await createHarnessDb();
  await applyMigrations(sql);
  profileA = await provisionBySubject(SUBJECT_A, "a@example.com");
  profileB = await provisionBySubject(SUBJECT_B, "b@example.com");
  profileC = await provisionBySubject(SUBJECT_C, "c@example.com");
  profileD = await provisionBySubject(SUBJECT_D, "d@example.com");
});

afterAll(async () => {
  await sql?.end();
});

describe("provisioning (resolveActor contract)", () => {
  it("one profile per subject, recorded with auth_provider 'clerk'", async () => {
    const rows = await sql`
      select id, auth_provider from profiles where clerk_subject = ${SUBJECT_A}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(profileA);
    expect(rows[0].auth_provider).toBe("clerk");
  });

  it("second sign-in resolves the same profile (idempotent identity)", async () => {
    // The subject lookup resolveActor runs before any provisioning.
    const again = await sql`
      select id from profiles where clerk_subject = ${SUBJECT_B}`;
    expect(again).toHaveLength(1);
    expect(again[0].id).toBe(profileB);
  });

  it("actor_profile_id() resolves Clerk subjects, legacy UUID subs, and null for strangers", async () => {
    const clerkResolved = await asUser(sql, SUBJECT_A, (tx) =>
      tx`select app.actor_profile_id() as id`,
    );
    expect(clerkResolved[0].id).toBe(profileA);

    // Legacy Supabase session: sub IS the profile UUID, no mapping.
    const legacy = crypto.randomUUID();
    await sql`insert into auth.users (id) values (${legacy})`;
    const legacyResolved = await asUser(sql, legacy, (tx) =>
      tx`select app.actor_profile_id() as id`,
    );
    expect(legacyResolved[0].id).toBe(legacy);

    const stranger = await asUser(sql, "user_2nobodyHome000000000000000x", (tx) =>
      tx`select app.actor_profile_id() as id`,
    );
    expect(stranger[0].id).toBeNull();
  });

  it("the two identity shapes cannot collide (mapped profile ignores legacy matching)", async () => {
    // sub = A's profile UUID, but A is clerk-mapped: the legacy match
    // requires a null clerk_subject, so nothing resolves.
    const crossShape = await asUser(sql, profileA, (tx) =>
      tx`select app.actor_profile_id() as id`,
    );
    expect(crossShape[0].id).toBeNull();
  });
});

// Actor-owned tables and the column holding their owner FK.
const OWNED_TABLES: Array<[string, string]> = [
  ["birth_profiles", "user_id"],
  ["daily_readings", "user_id"],
  ["people", "owner_id"],
  ["compatibility_reports", "owner_id"],
  ["reflections", "user_id"],
  ["notification_preferences", "user_id"],
  ["onboarding_profiles", "user_id"],
];

describe("cross-user isolation under Clerk identities", () => {
  // Seed one row per owned table for B, acting as B's Clerk session.
  beforeAll(async () => {
    await asUser(sql, SUBJECT_B, async (tx) => {
      await tx`insert into birth_profiles (user_id, birth_date, birth_time_precision, birth_time_zone, birth_lat, birth_lon)
               values (${profileB}, '1991-01-02', 'exact', 'Europe/London', 51.5, -0.1)`;
      await tx`insert into daily_readings (user_id, for_date, headline, explanation, dos, donts, life_areas, provenance, uncertainty_note)
               values (${profileB}, '2026-11-04', 'h', 'e', '[]', '[]', '[]', '{}', 'u')`;
      const [person] =
        await tx`insert into people (owner_id, display_name) values (${profileB}, 'B person') returning id`;
      await tx`insert into compatibility_reports (owner_id, person_id, dimensions, provenance)
               values (${profileB}, ${person.id}, '[]', '{}')`;
      await tx`insert into reflections (user_id, for_date, body)
               values (${profileB}, '2026-11-04', 'b note')`;
      await tx`insert into notification_preferences (user_id) values (${profileB})`;
      await tx`insert into onboarding_profiles (user_id) values (${profileB})`;
    });
  });

  for (const [table, ownerCol] of OWNED_TABLES) {
    // PK column per table: birth_profiles is user-keyed; the preferences
    // and onboarding tables use user_id as their primary key.
    const idCol =
      table === "people" || table === "compatibility_reports"
        ? "id"
        : ownerCol;
    it(`${table}: A cannot read, update, or delete B's rows; B sees one`, async () => {
      // Identifiers are whitelisted constants from OWNED_TABLES above;
      // only values are bound parameters.
      const bRows = await asUser(sql, SUBJECT_B, (tx) =>
        tx.unsafe(`select * from ${table} where ${ownerCol} = $1`, [profileB]),
      );
      expect(bRows.length, `no seeded B rows for ${table}`).toBeGreaterThan(0);
      const target = bRows[0] as Record<string, string>;

      const seenByA = await asUser(sql, SUBJECT_A, (tx) =>
        tx.unsafe(`select * from ${table} where ${idCol} = $1`, [
          target[idCol],
        ]),
      );
      expect(seenByA).toHaveLength(0);

      const updated = await asUser(sql, SUBJECT_A, (tx) =>
        tx.unsafe(
          `update ${table} set ${ownerCol} = ${ownerCol} where ${idCol} = $1 returning ${idCol}`,
          [target[idCol]],
        ),
      );
      expect(updated).toHaveLength(0);

      const deleted = await asUser(sql, SUBJECT_A, (tx) =>
        tx.unsafe(`delete from ${table} where ${idCol} = $1 returning ${idCol}`, [
          target[idCol],
        ]),
      );
      expect(deleted).toHaveLength(0);

      const stillThere = await asUser(sql, SUBJECT_B, (tx) =>
        tx.unsafe(`select * from ${table} where ${idCol} = $1`, [
          target[idCol],
        ]),
      );
      expect(stillThere).toHaveLength(1);
    });
  }

  it("inserting a row owned by another profile is rejected by WITH CHECK", async () => {
    await expect(
      asUser(sql, SUBJECT_B, (tx) =>
        tx`insert into people (owner_id, display_name) values (${profileA}, 'spoof')`,
      ),
    ).rejects.toThrowError(/row-level security|policy/i);
  });

  it("anon gets zero rows on every owned table", async () => {
    for (const [table] of OWNED_TABLES) {
      const rows = await asAnon(sql, (tx) => tx.unsafe(`select * from ${table}`));
      expect(rows, `${table} visible to anon`).toHaveLength(0);
    }
  });

  it("service role still reaches rows (bypass-RLS admin context)", async () => {
    const rows = await asServiceRole(sql, (tx) =>
      tx`select count(*)::int as n from people`,
    );
    expect(rows[0].n).toBeGreaterThanOrEqual(1);
  });
});

describe("connections under Clerk identities (state machine + audit)", () => {
  it("request → recipient-only accept → audit actor resolved through the subject", async () => {
    const [conn] = await asUser(sql, SUBJECT_A, (tx) =>
      tx`insert into connections (requester_id, addressee_id, state)
         values (${profileA}, ${profileB}, 'requested') returning id`,
    );

    // Requester self-accept is rejected even with a resolved identity —
    // the guard reads the actor through actor_profile_id().
    await expect(
      asUser(sql, SUBJECT_A, (tx) =>
        tx`update connections set state = 'accepted' where id = ${conn.id}`,
      ),
    ).rejects.toThrowError(/only the recipient can accept/i);

    await asUser(sql, SUBJECT_B, (tx) =>
      tx`update connections set state = 'accepted' where id = ${conn.id}`,
    );

    const [row] = await asUser(sql, SUBJECT_B, (tx) =>
      tx`select state, share_scope from connections where id = ${conn.id}`,
    );
    expect(row.state).toBe("accepted");
    expect(row.share_scope).toBe("chart_placements");

    // The audit log's actor is the accepting addressee's profile — not
    // the requester fallback a null auth.uid() used to produce.
    const log = await asUser(sql, SUBJECT_B, (tx) =>
      tx`select actor_id, to_state from connection_state_log
         where connection_id = ${conn.id} order by at asc`,
    );
    expect(log.length).toBeGreaterThanOrEqual(1);
    expect(log[log.length - 1].to_state).toBe("accepted");
    expect(log[log.length - 1].actor_id).toBe(profileB);
  });

  it("participants read their own log rows; anon reads none", async () => {
    const seenByA = await asUser(sql, SUBJECT_A, (tx) =>
      tx`select count(*)::int as n from connection_state_log`,
    );
    expect(seenByA[0].n).toBeGreaterThanOrEqual(1);
    const anonRows = await asAnon(sql, (tx) =>
      tx`select * from connection_state_log`,
    );
    expect(anonRows).toHaveLength(0);
  });
});

describe("revocation cuts partner access at the data layer", () => {
  it("after revoke, the accepted-state precondition the routes 404 on is gone", async () => {
    // Fresh pair: C requests D, D accepts.
    const [conn] = await asUser(sql, SUBJECT_C, (tx) =>
      tx`insert into connections (requester_id, addressee_id, state)
         values (${profileC}, ${profileD}, 'requested') returning id`,
    );
    await asUser(sql, SUBJECT_D, (tx) =>
      tx`update connections set state = 'accepted' where id = ${conn.id}`,
    );

    // RLS grants nothing to the partner even while accepted — granted
    // fields flow through the API, which 404s without an accepted row.
    const dRowsWhileAccepted = await asUser(sql, SUBJECT_C, (tx) =>
      tx`select user_id from birth_profiles where user_id = ${profileD}`,
    );
    expect(dRowsWhileAccepted).toHaveLength(0);

    // Either participant revokes; the accepted state is gone immediately.
    await asUser(sql, SUBJECT_C, (tx) =>
      tx`update connections set state = 'revoked' where id = ${conn.id}`,
    );

    for (const subject of [SUBJECT_C, SUBJECT_D]) {
      const accepted = await asUser(sql, subject, (tx) =>
        tx`select id from connections
           where requester_id = ${profileC} and addressee_id = ${profileD}
             and state = 'accepted'`,
      );
      expect(accepted).toHaveLength(0);
    }

    // The ended row stays readable to both participants for audit only.
    const audit = await asUser(sql, SUBJECT_D, (tx) =>
      tx`select state from connections where id = ${conn.id}`,
    );
    expect(audit[0].state).toBe("revoked");

    // Isolation is untouched by the revoked grant: C still cannot read
    // D's rows.
    const dRows = await asUser(sql, SUBJECT_C, (tx) =>
      tx`select user_id from birth_profiles where user_id = ${profileD}`,
    );
    expect(dRows).toHaveLength(0);
  });
});

describe("policy invariant (W1 verification)", () => {
  it("no auth.uid() ownership matching remains on any RLS policy", async () => {
    const rows = await sql`
      select tablename, policyname from pg_policies
      where schemaname = 'public'
        and (qual ilike '%auth.uid%' or with_check ilike '%auth.uid%')`;
    expect(rows).toEqual([]);
  });
});
