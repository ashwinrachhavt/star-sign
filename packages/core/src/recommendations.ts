/**
 * Daily recommendations (ASH-264 / 7.2).
 *
 * Curated dataset (public-domain + original content, see
 * data/recommendations/README.md for sourcing/licensing) matched to the
 * day's transit themes. Recs exist only when an event matches a theme —
 * never random filler (criterion 2). Every rec traces to the event that
 * matched it (criterion 1).
 */
import dataset from "./data/recommendations/dataset.json";
import type { Planet, ReadingProvenanceInput } from "./types";
import type { TransitEvent } from "./ruleset";

export const DATASET_VERSION = dataset.datasetVersion;

type AspectFamily = "conjunction" | "sextile" | "square" | "trine" | "opposition";
type Mood = "awake" | "warm" | "steadying" | "intense";

interface RecItem {
  id: string;
  kind: "read" | "watch" | "listen";
  title: string;
  creator: string;
  blurb: string;
  url: string;
  themes: { planets: Planet[]; aspects: AspectFamily[]; moods: Mood[] };
}

const ITEMS = dataset.items as RecItem[];

export interface Recommendation {
  item: RecItem;
  /** The event whose theme matched this rec (criterion 1 provenance). */
  matchedEvent: ReadingProvenanceInput;
  /** Which theme dimension matched. */
  matchedOn: "planet" | "aspect";
}

/**
 * Planet → mood mapping for aspect-family matching fallback: friction
 * families read "intense", flowing families read "warm"/"steadying".
 */
function moodForFamily(family: AspectFamily): Mood {
  switch (family) {
    case "square":
    case "opposition":
      return "intense";
    case "conjunction":
      return "awake";
    case "trine":
      return "warm";
    case "sextile":
      return "steadying";
  }
}

/**
 * Recommends up to `count` items for the day's events. Deterministic:
 * same events → same recs (stable order by dataset position, seeded
 * rotation by day so consecutive days vary within the matching pool).
 */
export function recommendForEvents(
  events: TransitEvent[],
  seed: number,
  count = 3,
): Recommendation[] {
  if (events.length === 0) return [];

  const matched: Recommendation[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    for (const item of ITEMS) {
      if (seen.has(item.id)) continue;
      const planetMatch = item.themes.planets.includes(event.transit) ||
        item.themes.planets.includes(event.natal);
      const aspectMatch = item.themes.aspects.includes(event.type);
      if (!planetMatch && !aspectMatch) continue; // criterion 2: theme match required

      seen.add(item.id);
      matched.push({
        item,
        matchedEvent: {
          kind: "transit",
          planet: event.transit,
          sign: event.transitSign ?? "aries",
          natal: event.natal,
          aspect: event.type,
          orb: event.orb,
        },
        matchedOn: planetMatch ? "planet" : "aspect",
      });
      if (matched.length >= count * 2) break; // pool cap; rotation picks below
    }
    if (matched.length >= count * 2) break;
  }

  // Deterministic rotation over the matched pool so the same themes on
  // different days surface different items. Bounded scan: step 3 through
  // the pool at most once — never loop past the pool size.
  const picked: Recommendation[] = [];
  const steps = Math.min(matched.length, count);
  for (let i = 0; i < steps; i++) {
    const idx = (seed + i * 3) % matched.length;
    const candidate = matched[idx];
    if (!picked.includes(candidate)) picked.push(candidate);
  }
  return picked;
}
