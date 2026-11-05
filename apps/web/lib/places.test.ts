/**
 * Birth-place picker logic tests (owner request: searchable place
 * selection) — typeahead candidate handling, keyboard-nav state,
 * selection state, and the actionable-error copy.
 */
import { describe, it, expect } from "vitest";
import {
  applyPick,
  candidateTitle,
  candidateZone,
  dedupeCandidates,
  geocodeFailureMessage,
  nextActiveIndex,
  shouldFetchPlaceQuery,
  type PlaceCandidate,
} from "./places";

const pune: PlaceCandidate = {
  name: "Pune",
  admin1: "Maharashtra",
  country: "India",
  timezone: "Asia/Kolkata",
  lat: 18.51957,
  lon: 73.85535,
};

const la: PlaceCandidate = {
  name: "Los Angeles",
  admin1: "California",
  country: "United States",
  timezone: "America/Los_Angeles",
  lat: 34.05223,
  lon: -118.24368,
};

describe("candidateTitle", () => {
  it("joins name, admin1, and country", () => {
    expect(candidateTitle(pune)).toBe("Pune, Maharashtra, India");
  });

  it("skips a missing admin1", () => {
    expect(candidateTitle({ ...pune, admin1: null })).toBe("Pune, India");
  });

  it("skips a missing country", () => {
    expect(candidateTitle({ ...pune, country: null })).toBe("Pune, Maharashtra");
  });

  it("falls back to the bare name", () => {
    expect(candidateTitle({ ...pune, admin1: null, country: null })).toBe("Pune");
  });

  it("trims whitespace parts instead of joining blanks", () => {
    expect(candidateTitle({ ...pune, admin1: "  " })).toBe("Pune, India");
  });
});

describe("candidateZone", () => {
  it("returns the provider zone", () => {
    expect(candidateZone(pune)).toBe("Asia/Kolkata");
  });

  it("returns null for blank or missing zones", () => {
    expect(candidateZone({ ...pune, timezone: null })).toBeNull();
    expect(candidateZone({ ...pune, timezone: "  " })).toBeNull();
  });
});

describe("dedupeCandidates", () => {
  it("drops exact duplicates (same place string and coordinates)", () => {
    expect(dedupeCandidates([pune, { ...pune }])).toEqual([pune]);
  });

  it("keeps same-named places in different regions (the two Springfields)", () => {
    const springfieldIl: PlaceCandidate = {
      ...pune,
      name: "Springfield",
      admin1: "Illinois",
      lat: 39.7817,
      lon: -89.65013,
    };
    const springfieldMo: PlaceCandidate = {
      ...pune,
      name: "Springfield",
      admin1: "Missouri",
      lat: 37.21533,
      lon: -93.29825,
    };
    expect(dedupeCandidates([springfieldIl, springfieldMo])).toEqual([
      springfieldIl,
      springfieldMo,
    ]);
  });

  it("keeps a bare-name hit that shares the title with a regional hit", () => {
    const bare: PlaceCandidate = { ...pune, admin1: null };
    // Same name+country but a distinct title string → both stay.
    expect(dedupeCandidates([pune, bare])).toEqual([pune, bare]);
  });
});

describe("shouldFetchPlaceQuery", () => {
  it("refuses queries below the route's 2-char minimum", () => {
    expect(shouldFetchPlaceQuery("", null)).toBe(false);
    expect(shouldFetchPlaceQuery("P", null)).toBe(false);
  });

  it("fetches a real query with nothing picked", () => {
    expect(shouldFetchPlaceQuery("Pune", null)).toBe(true);
  });

  it("does not re-fetch the picked title sitting in the box", () => {
    expect(shouldFetchPlaceQuery("Pune, Maharashtra, India", "Pune, Maharashtra, India")).toBe(false);
  });

  it("fetches again once the text diverges from the pick", () => {
    expect(
      shouldFetchPlaceQuery("Pune, Maharashtra, Indi", "Pune, Maharashtra, India"),
    ).toBe(true);
  });
});

describe("nextActiveIndex", () => {
  it("ArrowDown activates the first option from a closed list", () => {
    expect(nextActiveIndex("ArrowDown", -1, 3)).toBe(0);
  });

  it("ArrowDown clamps at the last option (no wrap)", () => {
    expect(nextActiveIndex("ArrowDown", 2, 3)).toBe(2);
  });

  it("ArrowUp clamps at the first option", () => {
    expect(nextActiveIndex("ArrowUp", 0, 3)).toBe(0);
  });

  it("ArrowUp from nothing active moves to the first option", () => {
    expect(nextActiveIndex("ArrowUp", -1, 3)).toBe(0);
  });

  it("Home and End jump to the bounds", () => {
    expect(nextActiveIndex("Home", 2, 3)).toBe(0);
    expect(nextActiveIndex("End", 0, 3)).toBe(2);
  });

  it("an empty list never has an active option", () => {
    expect(nextActiveIndex("ArrowDown", -1, 0)).toBe(-1);
  });
});

describe("applyPick", () => {
  it("locks coordinates and the canonical label", () => {
    const { place } = applyPick(pune, "America/New_York");
    expect(place).toEqual({
      lat: 18.51957,
      lon: 73.85535,
      resolvedName: "Pune, Maharashtra, India",
      country: "India",
      timezone: "Asia/Kolkata",
    });
  });

  it("adopts the provider's zone suggestion", () => {
    const { timeZone } = applyPick(la, "Europe/London");
    expect(timeZone).toBe("America/Los_Angeles");
  });

  it("keeps the user's zone when the candidate carries none", () => {
    const { timeZone } = applyPick({ ...pune, timezone: null }, "Europe/London");
    expect(timeZone).toBe("Europe/London");
  });
});

describe("geocodeFailureMessage", () => {
  it("names the query that found nothing", () => {
    expect(geocodeFailureMessage("not_found", "Xyzzyqville")).toBe(
      'No places matched "Xyzzyqville". Try a nearby city or check the spelling.',
    );
  });

  it("distinguishes provider-down from no-match and rate limiting", () => {
    expect(geocodeFailureMessage("upstream_unavailable")).toBe(
      "We couldn't reach the place service. Try again in a moment.",
    );
    expect(geocodeFailureMessage("rate_limited")).toBe(
      "Too many lookups. Wait a moment and try again.",
    );
    expect(geocodeFailureMessage("network")).toBe(
      "We couldn't reach the place service. Check your connection and try again.",
    );
  });
});
