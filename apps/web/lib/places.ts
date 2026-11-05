/**
 * Birth-place picker logic (owner request: searchable place selection —
 * typeahead candidates, explicit pick, locked coordinates).
 *
 * Pure functions only: the vitest harness runs in node with no DOM, so
 * the combobox behavior below the render seam (candidate display, list
 * dedupe, keyboard-nav state, selection state, error copy) lives here.
 * The geocode route imports the copy helpers too — one source of truth
 * for the actionable-error wording, tested in lib/places.test.ts.
 */

/** One candidate place from POST /api/geocode. */
export interface PlaceCandidate {
  name: string;
  /** Admin division (state/region), when the provider returns one. */
  admin1: string | null;
  country: string | null;
  /** Provider's IANA zone suggestion for this place. */
  timezone: string | null;
  lat: number;
  lon: number;
}

/** The locked coordinates an explicit pick commits the form to. */
export interface PickedPlace {
  lat: number;
  lon: number;
  /** Canonical display label — "Pune, Maharashtra, India". */
  resolvedName: string;
  country: string | null;
  timezone: string | null;
}

/** "Pune" + "Maharashtra" + "India" → "Pune, Maharashtra, India" (blanks skipped). */
export function candidateTitle(candidate: PlaceCandidate): string {
  return [candidate.name, candidate.admin1, candidate.country]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

/** The meta line under a candidate title: the zone the pick would adopt. */
export function candidateZone(candidate: PlaceCandidate): string | null {
  return candidate.timezone?.trim() || null;
}

/** Dedupe candidates resolving to the same place string and coordinates. */
export function dedupeCandidates(candidates: PlaceCandidate[]): PlaceCandidate[] {
  const seen = new Set<string>();
  const unique: PlaceCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidateTitle(candidate).toLowerCase()}|${candidate.lat.toFixed(4)},${candidate.lon.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}

/**
 * Whether the debounced effect should fetch for this query. Below 2
 * characters the route schema can't accept it; the picked candidate's own
 * title sitting in the box (set by the pick, restored by edit-mode
 * prefill) is not a new search.
 */
export function shouldFetchPlaceQuery(
  query: string,
  pickedResolvedName: string | null,
): boolean {
  const q = query.trim();
  if (q.length < 2) return false;
  if (pickedResolvedName == null) return true;
  return q.toLowerCase() !== pickedResolvedName.trim().toLowerCase();
}

/** Which key moved the active option (listbox keyboard nav). */
export type MoveKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

/**
 * Active-index transitions for the listbox (clamped, not wrapping —
 * ArrowDown on the last option stays there, matching the calm, minimal
 * motion language). -1 means nothing active yet.
 */
export function nextActiveIndex(key: MoveKey, current: number, count: number): number {
  if (count <= 0) return -1;
  switch (key) {
    case "ArrowDown":
      return Math.min(current + 1, count - 1);
    case "ArrowUp":
      return Math.max(current - 1, 0);
    case "Home":
      return 0;
    case "End":
      return count - 1;
  }
}

/**
 * Selection state: what an explicit pick commits. Coordinates and the
 * canonical label lock; the provider's IANA zone suggestion is adopted
 * when present (the existing onboarding behavior) and the user's zone
 * is kept otherwise.
 */
export function applyPick(
  candidate: PlaceCandidate,
  currentTimeZone: string | null,
): { place: PickedPlace; timeZone: string | null } {
  return {
    place: {
      lat: candidate.lat,
      lon: candidate.lon,
      resolvedName: candidateTitle(candidate),
      country: candidate.country,
      timezone: candidate.timezone,
    },
    timeZone: candidate.timezone ?? currentTimeZone,
  };
}

/** The geocode failure classes the form can surface. */
export type GeocodeFailure =
  | "not_found"
  | "upstream_unavailable"
  | "rate_limited"
  | "network"
  | "unknown";

/**
 * Actionable error copy per failure class — the form never fails
 * silently. The route sends the same wording in its envelope (single
 * source of truth); the client falls back to this when the envelope is
 * missing or unreadable.
 */
export function geocodeFailureMessage(
  failure: GeocodeFailure,
  query?: string,
): string {
  switch (failure) {
    case "not_found":
      return `No places matched "${query ?? ""}". Try a nearby city or check the spelling.`;
    case "upstream_unavailable":
      return "We couldn't reach the place service. Try again in a moment.";
    case "rate_limited":
      return "Too many lookups. Wait a moment and try again.";
    case "network":
      return "We couldn't reach the place service. Check your connection and try again.";
    case "unknown":
      return "Something went wrong resolving that place. Try again in a moment.";
  }
}
