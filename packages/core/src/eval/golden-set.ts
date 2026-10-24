import type { BirthProfile } from "../types";

/**
 * Golden set (ASH-250 / 3.5a): 10 birth profiles × 5 dates.
 * Mixed precisions — 4 exact (G01–G04), 3 approximate (G05–G07),
 * 3 unknown (G08–G10) — real cities and zones, synthetic identities (no
 * personal data). Dates span quiet and busy transits plus a retrograde
 * window (2026-03-01: Mercury Rx).
 *
 * PROVENANCE: synthetic profiles constructed for testing; coordinates are
 * real city centers (public data). No real persons' birth data.
 */
export const GOLDEN_PROFILES: Array<BirthProfile & { id: string }> = [
  {
    id: "G01",
    birthDate: "1990-06-15",
    birthTime: "08:30",
    birthTimePrecision: "exact",
    birthTimeZone: "America/New_York",
    birthPlace: { lat: 40.7128, lon: -74.006 },
  },
  {
    id: "G02",
    birthDate: "1985-11-30",
    birthTime: "14:45",
    birthTimePrecision: "exact",
    birthTimeZone: "Asia/Kolkata",
    birthPlace: { lat: 19.076, lon: 72.8777 },
  },
  {
    id: "G03",
    birthDate: "2000-02-29",
    birthTime: "23:10",
    birthTimePrecision: "exact",
    birthTimeZone: "Europe/Berlin",
    birthPlace: { lat: 52.52, lon: 13.405 },
  },
  {
    id: "G04",
    birthDate: "1975-08-08",
    birthTime: "06:15",
    birthTimePrecision: "exact",
    birthTimeZone: "America/Los_Angeles",
    birthPlace: { lat: 34.0522, lon: -118.2437 },
  },
  {
    id: "G05",
    birthDate: "2010-01-22",
    birthTime: "19:00",
    birthTimePrecision: "approximate",
    birthTimeZone: "Australia/Sydney",
    birthPlace: { lat: -33.8688, lon: 151.2093 },
  },
  {
    id: "G06",
    birthDate: "1992-11-03",
    birthTime: "08:15",
    birthTimePrecision: "approximate",
    birthTimeZone: "America/Chicago",
    birthPlace: { lat: 41.8781, lon: -87.6298 },
  },
  {
    id: "G07",
    birthDate: "1988-04-12",
    birthTime: "17:20",
    birthTimePrecision: "approximate",
    birthTimeZone: "Europe/London",
    birthPlace: { lat: 51.5074, lon: -0.1278 },
  },
  {
    id: "G08",
    birthDate: "1995-09-28",
    birthTimePrecision: "unknown",
    birthTimeZone: "Asia/Tokyo",
    birthPlace: { lat: 35.6762, lon: 139.6503 },
  },
  {
    id: "G09",
    birthDate: "1983-07-19",
    birthTimePrecision: "unknown",
    birthTimeZone: "America/Denver",
    birthPlace: { lat: 39.7392, lon: -104.9903 },
  },
  {
    id: "G10",
    birthDate: "2001-12-05",
    birthTimePrecision: "unknown",
    birthTimeZone: "Europe/Paris",
    birthPlace: { lat: 48.8566, lon: 2.3522 },
  },
];

export const GOLDEN_DATES = [
  "2026-03-01", // Mercury retrograde window
  "2026-06-15",
  "2026-08-20",
  "2026-10-24",
  "2027-01-05",
] as const;
