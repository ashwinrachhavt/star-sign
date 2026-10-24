import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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
  const migration = readFileSync(
    path.join(repoRoot, "supabase/migrations/0002_data_model_v2.sql"),
    "utf8",
  );

  const defaultFor = (column: string) => {
    const re = new RegExp(
      `add column ${column} text not null default '([^']+)'`,
    );
    const m = migration.match(re);
    if (!m) throw new Error(`No default found for ${column} in migration 0002`);
    return m[1];
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
