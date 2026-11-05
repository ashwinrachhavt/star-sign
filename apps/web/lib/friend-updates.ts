/**
 * Friend updates (W2 / SHAPE F): a connected person's daily theme,
 * derived on read from THEIR chart basis + today's transits.
 *
 * Nothing is persisted (unlike getOrCreateDailyReading) and nothing raw
 * leaves the server: the projection below carries headline, life-area
 * states, and birth-time precision — never dates, times, or coordinates.
 * The grant is rechecked per request by the route before deriving.
 */
import {
  computeNatalChart,
  computeTransits,
  generateDailyReading,
  rankLifeAreas,
  resolveNoonLocal,
  scoreTransitEvents,
  type FriendUpdate,
} from "@star-sign/core";
import { rowToBirthProfile, type BirthProfileRow } from "@/lib/readings";

/** Today's calendar date in a zone (en-CA → YYYY-MM-DD). */
export function todayForZone(timeZone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(at);
}

/**
 * Derives one friend update through the same pipeline that produces the
 * person's own reading — same noon sky moment (resolveNoonLocal) for both
 * the headline and the ranked areas, so the card can never disagree with
 * what they see on their own day screen.
 */
export function deriveFriendUpdate(args: {
  connectionId: string;
  displayName: string;
  handle: string | null;
  birthRow: BirthProfileRow;
  forDate: string;
}): FriendUpdate {
  const { connectionId, displayName, handle, birthRow, forDate } = args;
  const profile = rowToBirthProfile(birthRow);

  const now = resolveNoonLocal(profile.birthTimeZone, forDate);
  const reading = generateDailyReading({ profile, forDate, now });
  const chart = computeNatalChart(profile);
  const events = scoreTransitEvents(computeTransits(chart, now));
  const lifeAreas = rankLifeAreas(events).map((r) => ({
    area: r.area as string,
    state: r.temperature,
  }));

  return {
    connectionId,
    displayName,
    handle,
    headline: reading.headline,
    lifeAreas,
    basis: { precision: profile.birthTimePrecision },
    uncertaintyNote: reading.uncertaintyNote,
  };
}
