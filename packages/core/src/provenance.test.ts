import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  RULESET_VERSION,
  COPY_VERSION,
  EPHEMERIS_NAME,
  EPHEMERIS_VERSION,
} from "./reading.js";

const repoRoot = path.join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../..",
);

describe("provenance constants agree with the database (ASH-232 criterion 3)", () => {
  const migrationsDir = path.join(repoRoot, "supabase/migrations");
  const migrations = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // Effective default = last `set default` (or initial add-column default)
  // for the column across migrations, applied in filename order.
  const defaultFor = (column: string) => {
    let current: string | null = null;
    const addRe = new RegExp(`add column ${column} text not null default '([^']+)'`);
    const setRe = new RegExp(`alter column ${column} set default '([^']+)'`);
    for (const file of migrations) {
      const sql = readFileSync(path.join(migrationsDir, file), "utf8");
      for (const line of sql.split("\n")) {
        const add = line.match(addRe);
        if (add) current = add[1];
        const set = line.match(setRe);
        if (set) current = set[1];
      }
    }
    if (current === null) throw new Error(`No default found for ${column} in migrations`);
    return current;
  };

  it("ruleset_version matches RULESET_VERSION", () => {
    expect(defaultFor("ruleset_version")).toBe(RULESET_VERSION);
  });

  it("copy_version matches COPY_VERSION", () => {
    expect(defaultFor("copy_version")).toBe(COPY_VERSION);
  });

  it("ephemeris_name matches EPHEMERIS_NAME", () => {
    expect(defaultFor("ephemeris_name")).toBe(EPHEMERIS_NAME);
  });

  it("ephemeris_version matches EPHEMERIS_VERSION", () => {
    expect(defaultFor("ephemeris_version")).toBe(EPHEMERIS_VERSION);
  });
});

describe("reading generation carries full provenance", () => {
  it("generated reading includes ephemeris + selected events", async () => {
    const core = await import("./index.js");
    const reading = core.generateDailyReading({
      profile: {
        birthDate: "1990-06-15",
        birthTime: "09:30",
        birthTimePrecision: "exact",
        birthTimeZone: "America/New_York",
        birthPlace: { lat: 40.7, lon: -74.0 },
      },
      forDate: "2026-10-24",
    });
    expect(reading.provenance.ephemerisName).toBe(EPHEMERIS_NAME);
    expect(reading.provenance.ephemerisVersion).toBe(EPHEMERIS_VERSION);
    expect(Array.isArray(reading.provenance.selectedEvents)).toBe(true);
  });
});
