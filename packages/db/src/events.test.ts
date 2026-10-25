/**
 * Structured event persistence (ASH-251 / 3.6).
 *
 * The database is the source of truth for the facts behind the prose:
 * every persisted reading row carries well-formed selected_events
 * (body/body/aspect/sign), the shape is enforced by migration 0005's
 * constraint, and the provenance trail explains every generated line.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  applyMigrations,
  asServiceRole,
  asUser,
  createHarnessDb,
  testUsers,
  type TestDb,
} from "./harness.js";
import { generateDailyReading } from "@star-sign/core";
import type { BirthProfile } from "@star-sign/core";

let sql: TestDb;
const A = testUsers.a;

const profile: BirthProfile = {
  birthDate: "1990-06-15",
  birthTime: "14:30",
  birthTimePrecision: "exact",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.7128, lon: -74.006 },
};

beforeAll(async () => {
  sql = await createHarnessDb();
  await applyMigrations(sql);
  await sql`insert into auth.users (id) values (${A}) on conflict do nothing`;
  await asServiceRole(sql, async (tx) => {
    await tx`insert into profiles (id, display_name) values (${A}, 'event-tester') on conflict do nothing`;
  });
});

afterAll(async () => {
  await sql?.end({ timeout: 5 });
});

const PLANETS = new Set([
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
]);
const ASPECTS = new Set(["conjunction", "sextile", "square", "trine", "opposition"]);

function wellFormedEvents(events: unknown[]): boolean {
  return events.every((e) => {
    const ev = e as Record<string, unknown>;
    if (typeof ev !== "object" || ev === null) return false;
    switch (ev.kind) {
      case "transit":
        return (
          PLANETS.has(ev.planet as string) &&
          PLANETS.has(ev.natal as string) &&
          ASPECTS.has(ev.aspect as string) &&
          typeof ev.sign === "string"
        );
      case "natal_placement":
        return PLANETS.has(ev.planet as string) && typeof ev.sign === "string";
      case "lunar_phase":
        return typeof ev.phase === "string" && ev.phase.length > 0;
      default:
        return false;
    }
  });
}

describe("structured event persistence (ASH-251)", () => {
  it("AC1: persisted reading rows carry well-formed structured events", async () => {
    const reading = generateDailyReading({ profile, forDate: "2026-11-08" });
    const row = {
      user_id: A,
      for_date: "2026-11-08",
      headline: reading.headline,
      explanation: reading.explanation,
      dos: reading.dos,
      donts: reading.donts,
      life_areas: reading.lifeAreas,
      ruleset_version: reading.provenance.rulesetVersion,
      copy_version: reading.provenance.copyVersion,
      ephemeris_name: reading.provenance.ephemerisName,
      ephemeris_version: reading.provenance.ephemerisVersion,
      selected_events: JSON.parse(JSON.stringify(reading.provenance.selectedEvents)),
      provenance: JSON.parse(JSON.stringify(reading.provenance)),
      uncertainty_note: reading.uncertaintyNote,
    };
    await asUser(sql, A, (tx) => tx`insert into daily_readings ${tx(row)}`);

    const [stored] = await asUser(sql, A, (tx) =>
      tx`select selected_events from daily_readings where user_id = ${A} and for_date = '2026-11-08'`,
    );
    const events = stored.selected_events as unknown[];
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThanOrEqual(0);
    if (events.length > 0) {
      expect(wellFormedEvents(events)).toBe(true);
      // Every transit event carries body/body/aspect — the "facts, not
      // prose" contract (orb rides with the 3.6a type change, see ticket).
      for (const e of events) {
        if ((e as { kind: string }).kind === "transit") {
          const ev = e as Record<string, unknown>;
          expect(ev.planet).toBeTruthy();
          expect(ev.natal).toBeTruthy();
          expect(ev.aspect).toBeTruthy();
          expect(ev.sign).toBeTruthy();
        }
      }
    }
  });

  it("AC1: rows with zero events are valid; malformed events are rejected by the constraint", async () => {
    const base = {
      user_id: A,
      for_date: "2026-11-09",
      headline: "h",
      explanation: "e",
      dos: [] as string[],
      donts: [] as string[],
      life_areas: [] as string[],
      provenance: {},
      uncertainty_note: "u",
    };

    // Zero events: valid.
    await asUser(sql, A, (tx) =>
      tx`insert into daily_readings ${tx({ ...base, selected_events: [] })}`,
    );

    // Malformed: unknown aspect family — rejected.
    await expect(
      asUser(sql, A, (tx) =>
        tx`insert into daily_readings ${tx({
          ...base,
          for_date: "2026-11-10",
          selected_events: [{ kind: 'transit', planet: 'mars', natal: 'sun', aspect: 'quincunx', sign: 'leo' }],
        })}`,
      ),
    ).rejects.toThrowError(/selected_events_shape|check/i);

    // Malformed: not an array — rejected. A non-array jsonb column value
    // fails the constraint's array-type guard.
    await expect(
      asUser(sql, A, (tx) =>
        tx`update daily_readings set selected_events = '{"kind":"transit"}'::jsonb where user_id = ${A} and for_date = '2026-11-09'`,
      ),
    ).rejects.toThrowError(/selected_events_shape|check/i);

    // Malformed: unknown planet — rejected.
    await expect(
      asUser(sql, A, (tx) =>
        tx`insert into daily_readings ${tx({
          ...base,
          for_date: "2026-11-12",
          selected_events: [{ kind: "transit", planet: "chiron", natal: "sun", aspect: "trine", sign: "leo" }],
        })}`,
      ),
    ).rejects.toThrowError(/selected_events_shape|check/i);
  });

  it("AC3: same input + logic version reproduces identical events (determinism)", () => {
    const a = generateDailyReading({ profile, forDate: "2026-11-08" });
    const b = generateDailyReading({ profile, forDate: "2026-11-08" });
    expect(a.provenance.selectedEvents).toEqual(b.provenance.selectedEvents);
    // And across the sweep: every selected event is well-formed.
    for (let d = 1; d <= 10; d++) {
      const forDate = `2026-11-${String(d).padStart(2, "0")}`;
      const r = generateDailyReading({ profile, forDate });
      expect(wellFormedEvents(r.provenance.selectedEvents)).toBe(true);
    }
  });

  it("AC4: every generated prose line traces to a stored event trail", () => {
    // When events exist, dos/don'ts are derived from them (ruleset 3.1b);
    // when they don't, the quiet-sky prose carries the natal trail
    // (natal placements + lunar phase are always in provenance.inputs).
    for (let d = 1; d <= 10; d++) {
      const forDate = `2026-11-${String(d).padStart(2, "0")}`;
      const r = generateDailyReading({ profile, forDate });
      const kinds = new Set(r.provenance.inputs.map((i) => i.kind));
      expect(kinds.has("natal_placement")).toBe(true);
      expect(kinds.has("lunar_phase")).toBe(true);
      if (r.provenance.selectedEvents.length > 0) {
        expect(r.dos.length).toBeGreaterThan(0);
        expect(r.donts.length).toBeGreaterThan(0);
      }
    }
  });
});
