/**
 * Sky events (ASH-253 / 4.2): engine-computed lunar phases and retrograde
 * windows. Every instant comes from astronomy-engine — never invented.
 *
 * Consumers: the week-ahead timeline (4.1) and notifications (7.1); the
 * sky-scan job persists these as queryable rows (criterion 3).
 */
import * as astro from "astronomy-engine";
import type { Planet } from "./types";
import { planetLongitude } from "./ephemeris";

export interface MoonPhaseEvent {
  kind: "moon_phase";
  /** "full" or "new" */
  detail: "full" | "new";
  body: "moon";
  /** Exact instant, UTC */
  at: Date;
}

export interface RetrogradeWindow {
  kind: "retrograde_window";
  body: Planet;
  detail: "retrograde";
  /** Station retrograde (daily motion turns negative) */
  startsAt: Date;
  /** Station direct (daily motion turns positive again) */
  endsAt: Date;
}

export type SkyEvent = MoonPhaseEvent | RetrogradeWindow;

const FULL_MOON_LON = 180;
const NEW_MOON_LON = 0;
/** Synodic month ≈ 29.53 days; a small margin avoids skipping phases. */
const LUNAR_SEARCH_MARGIN_DAYS = 2;

/**
 * Next N full moons after `from`, exact instants (criterion 1: within a
 * minute of published dates — astronomy-engine's accuracy is ~seconds).
 */
export function upcomingFullMoons(from: Date, count: number): MoonPhaseEvent[] {
  const out: MoonPhaseEvent[] = [];
  let cursor = from;
  for (let i = 0; i < count; i++) {
    const found = astro.SearchMoonPhase(
      FULL_MOON_LON,
      cursor,
      30 + LUNAR_SEARCH_MARGIN_DAYS,
    );
    if (!found) break;
    out.push({ kind: "moon_phase", detail: "full", body: "moon", at: found.date });
    cursor = new Date(found.date.getTime() + 24 * 3600 * 1000);
  }
  return out;
}

/**
 * Next N new moons after `from`.
 */
export function upcomingNewMoons(from: Date, count: number): MoonPhaseEvent[] {
  const out: MoonPhaseEvent[] = [];
  let cursor = from;
  for (let i = 0; i < count; i++) {
    const found = astro.SearchMoonPhase(
      NEW_MOON_LON,
      cursor,
      30 + LUNAR_SEARCH_MARGIN_DAYS,
    );
    if (!found) break;
    out.push({ kind: "moon_phase", detail: "new", body: "moon", at: found.date });
    cursor = new Date(found.date.getTime() + 24 * 3600 * 1000);
  }
  return out;
}

/** Apparent daily ecliptic motion of a planet, degrees/day (wrapping-aware). */
function dailyMotion(body: Planet, date: Date): number {
  const fwd = planetLongitude(body, new Date(date.getTime() + 12 * 3600 * 1000));
  const bwd = planetLongitude(body, new Date(date.getTime() - 12 * 3600 * 1000));
  return ((fwd.longitude - bwd.longitude + 540) % 360) - 180;
}

const DAY_MS = 86_400_000;
/** Scan granularity for station hunting; refined by bisection. */
const SCAN_STEP_DAYS = 1;
const BISECTION_PASSES = 20;

/**
 * Finds the next station (retrograde start or direct end) for a body after
 * `from` by bisection on the daily-motion sign change. Returns null when no
 * station occurs within `limitDays` (e.g. the Sun and Moon never station).
 */
function nextStation(
  body: Planet,
  from: Date,
  limitDays: number,
): { at: Date; motion: number } | null {
  let prevAt = new Date(from.getTime());
  // If `from` sits exactly on a station (common when chaining calls from
  // the previous station instant), motion there is 0 and its sign is
  // meaningless — seed the baseline from half a day later instead.
  let prevMotion = dailyMotion(body, prevAt);
  if (prevMotion === 0 || Math.abs(prevMotion) < 1e-6) {
    prevAt = new Date(from.getTime() + 12 * 3600 * 1000);
    prevMotion = dailyMotion(body, prevAt);
  }

  for (let d = SCAN_STEP_DAYS; d <= limitDays; d += SCAN_STEP_DAYS) {
    const at = new Date(from.getTime() + d * DAY_MS);
    const motion = dailyMotion(body, at);
    if (Math.sign(motion) !== Math.sign(prevMotion) && prevMotion !== 0) {
      // Bisection between prevAt and at for the sign change.
      let lo = prevAt.getTime();
      let hi = at.getTime();
      for (let i = 0; i < BISECTION_PASSES; i++) {
        const mid = (lo + hi) / 2;
        const midMotion = dailyMotion(body, new Date(mid));
        if (Math.sign(midMotion) === Math.sign(prevMotion)) lo = mid;
        else hi = mid;
      }
      const stationAt = new Date((lo + hi) / 2);
      // The sign AT the station is floating-noise (motion passes through
      // zero) — the reliable signal is the motion just after the flip.
      const afterMotion = dailyMotion(
        body,
        new Date(stationAt.getTime() + 12 * 3600 * 1000),
      );
      return { at: stationAt, motion: afterMotion };
    }
    prevAt = at;
    prevMotion = motion;
  }
  return null;
}

/**
 * All retrograde windows for `body` overlapping [from, from+limitDays].
 * Walks stations forward, alternating retrograde-start (motion < 0) and
 * direct-end (motion > 0) until the horizon is covered. Bodies that never
 * station (sun, moon) return an empty list.
 */
export function retrogradeWindows(
  body: Planet,
  from: Date,
  limitDays: number,
): RetrogradeWindow[] {
  if (body === "sun" || body === "moon") return [];

  const windows: RetrogradeWindow[] = [];
  let cursor = new Date(from.getTime());
  // A retrograde episode is a station pair: daily motion flips negative
  // (station Rx), stays negative ~3 weeks (Mercury), then flips positive
  // (station direct). We alternate start/end stations; pairs whose span
  // exceeds the physically plausible episode length are pairing artifacts
  // and discarded.
  const EPISODE_MAX_DAYS = 45;

  // Initial state: are we inside a retrograde episode at `from`?
  let inRetrograde = dailyMotion(body, cursor) < 0;

  for (let guard = 0; guard < 30; guard++) {
    const horizon = limitDays - (cursor.getTime() - from.getTime()) / DAY_MS;
    if (horizon <= 0) break;
    const station = nextStation(body, cursor, horizon);
    if (!station) break;

    if (inRetrograde) {
      // Next station must be the direct end of this episode.
      if (station.motion > 0) {
        // Find the episode's start: the most recent motion>0→<0 flip.
        const start = nextStation(
          body,
          new Date(station.at.getTime() - EPISODE_MAX_DAYS * DAY_MS),
          EPISODE_MAX_DAYS,
        );
        if (start && start.motion < 0 && start.at < station.at) {
          windows.push({
            kind: "retrograde_window",
            body,
            detail: "retrograde",
            startsAt: start.at,
            endsAt: station.at,
          });
        }
        inRetrograde = false;
      }
    } else if (station.motion < 0) {
      // Retrograde start; the direct end is the next station after it.
      const end = nextStation(body, station.at, EPISODE_MAX_DAYS);
      if (end && end.motion > 0) {
        const spanDays = (end.at.getTime() - station.at.getTime()) / DAY_MS;
        if (spanDays <= EPISODE_MAX_DAYS) {
          windows.push({
            kind: "retrograde_window",
            body,
            detail: "retrograde",
            startsAt: station.at,
            endsAt: end.at,
          });
        }
        cursor = new Date(end.at.getTime() + SCAN_STEP_DAYS * DAY_MS);
        continue;
      }
    }
    cursor = new Date(station.at.getTime() + SCAN_STEP_DAYS * DAY_MS);
  }

  return windows;
}

/**
 * Convenience: next N full moons + new moons, sorted by instant — the
 * feed for the week-ahead timeline and notification scheduling.
 */
export function upcomingLunarEvents(from: Date, count: number): MoonPhaseEvent[] {
  return [
    ...upcomingFullMoons(from, count),
    ...upcomingNewMoons(from, count),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
}
