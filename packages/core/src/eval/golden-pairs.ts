/**
 * Compatibility-report golden pairs (ASH-262 / 6.3).
 *
 * 4 chart pairs spanning easy/hard/tone-range synastry, synthetic
 * identities (no personal data). Reports are generated from these via
 * generateCompatibilityReport; every summary string must obey the copy
 * rules (checks.ts), and the snapshot is the regression baseline.
 */
import type { BirthProfile } from "../types";

const P1: BirthProfile = {
  birthDate: "1990-06-15",
  birthTime: "08:30",
  birthTimePrecision: "exact",
  birthTimeZone: "America/New_York",
  birthPlace: { lat: 40.7128, lon: -74.006 },
};

const P2: BirthProfile = {
  birthDate: "1985-11-30",
  birthTime: "14:45",
  birthTimePrecision: "exact",
  birthTimeZone: "Asia/Kolkata",
  birthPlace: { lat: 19.076, lon: 72.8777 },
};

const P3: BirthProfile = {
  birthDate: "2000-02-29",
  birthTime: "23:10",
  birthTimePrecision: "exact",
  birthTimeZone: "Europe/Berlin",
  birthPlace: { lat: 52.52, lon: 13.405 },
};

const P4: BirthProfile = {
  birthDate: "1975-08-08",
  birthTime: "06:15",
  birthTimePrecision: "exact",
  birthTimeZone: "America/Los_Angeles",
  birthPlace: { lat: 34.0522, lon: -118.2437 },
};

const P5: BirthProfile = {
  birthDate: "2010-01-22",
  birthTime: "19:00",
  birthTimePrecision: "exact",
  birthTimeZone: "Australia/Sydney",
  birthPlace: { lat: -33.8688, lon: 151.2093 },
};

const P6: BirthProfile = {
  birthDate: "1992-11-03",
  birthTime: "08:15",
  birthTimePrecision: "exact",
  birthTimeZone: "America/Chicago",
  birthPlace: { lat: 41.8781, lon: -87.6298 },
};

export const GOLDEN_PAIRS: Array<{
  pairId: string;
  a: BirthProfile;
  b: BirthProfile;
}> = [
  { pairId: "P1xP2", a: P1, b: P2 },
  { pairId: "P3xP4", a: P3, b: P4 },
  { pairId: "P5xP6", a: P5, b: P6 },
  { pairId: "P2xP4", a: P2, b: P4 },
];
