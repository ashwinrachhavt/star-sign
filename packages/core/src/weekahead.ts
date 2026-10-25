/**
 * Week-ahead 7-day transit timeline (ASH-252 / 4.1).
 *
 * Composes ONLY exported functions from chart.ts and ruleset.ts — every
 * event in the timeline is derivable from computeTransits output for that
 * day (no invented events). Deterministic: same profile + start date +
 * version → same timeline.
 */
import { computeNatalChart, computeTransits } from "./chart";
import { scoreTransitEvents, type TransitEvent } from "./ruleset";
import type { BirthProfile } from "./types";

export const WEEKAHEAD_VERSION = "2026-10.1";

export interface DayTimeline {
  /** ISO calendar date (local to the profile's birth zone), e.g. "2026-10-25". */
  date: string;
  /** Events for this day, ranked strongest-first. */
  events: TransitEvent[];
}

export interface WeekAhead {
  version: string;
  /** The 7 calendar dates covered (start = day after `now`, or `now` itself for day 0?). */
  days: DayTimeline[];
  /** True when no day in the window has any qualifying event. */
  quiet: boolean;
}

export interface WeekAheadOptions {
  /**
   * The instant "today" refers to (defaults to real time). Days run from
   * today's local calendar date through today+6.
   */
  now?: Date;
  /** Maximum events shown per day (default 3). */
  perDayCap?: number;
}

function localCalendarDate(timeZone: string, date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Local noon for a calendar date in a zone (mirrors reading.ts two-pass). */
function noonLocal(timeZone: string, forDate: string): Date {
  const [y, m, d] = forDate.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 12, 0);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const offset = (date: Date) => {
    const parts = dtf.formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return (Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second")) - date.getTime()) / 60000;
  };
  const o1 = offset(new Date(guess));
  const o2 = offset(new Date(guess - o1 * 60000));
  return new Date(guess - o2 * 60000);
}

/**
 * Computes the 7-day ahead timeline for a chart. Day N's events are the
 * scored transit events at that day's local noon — the same computation
 * the daily reading uses, so week and day never disagree.
 */
export function computeWeekAhead(
  profile: BirthProfile,
  options: WeekAheadOptions = {},
): WeekAhead {
  const now = options.now ?? new Date();
  const cap = options.perDayCap ?? 3;

  const startDate = localCalendarDate(profile.birthTimeZone, now);
  const chart = computeNatalChart(profile);

  const days: DayTimeline[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(startDate, i);
    const instant = noonLocal(profile.birthTimeZone, date);
    const transits = computeTransits(chart, instant);
    const events = scoreTransitEvents(transits).slice(0, cap);
    days.push({ date, events });
  }

  return {
    version: WEEKAHEAD_VERSION,
    days,
    quiet: days.every((d) => d.events.length === 0),
  };
}
