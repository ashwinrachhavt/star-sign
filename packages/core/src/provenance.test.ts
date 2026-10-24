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
  // Latest-wins scan of all migrations: a later ALTER COLUMN ... SET
  // DEFAULT supersedes an earlier one, so the effective default for a
  // column is the last mention across migration order.
  const migrations = readdirSync(path.join(repoRoot, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) =>
      readFileSync(path.join(repoRoot, "supabase/migrations", f), "utf8"),
    );

  const defaultFor = (column: string) => {
    // Matches both forms: "add column X text not null default 'v'" and
    // "alter column X set default 'v'" (case-insensitive, either form).
    const re = new RegExp(
      `(?:add|alter)\\s+column\\s+${column}\\s+(?:text\\s+not\\s+null\\s+)?default\\s+'([^']+)'|(?:add|alter)\\s+column\\s+${column}\\s+set\\s+default\\s+'([^']+)'`,
      "gi",
    );
    let last: string | null = null;
    for (const m of migrations) {
      for (const match of m.matchAll(re)) {
        last = match[1] ?? match[2];
      }
    }
    if (!last) throw new Error(`No default found for ${column} in any migration`);
    return last;
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
