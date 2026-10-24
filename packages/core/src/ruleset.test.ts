import { describe, expect, it } from "vitest";
import {
  dosForEvents,
  dontsForEvents,
  explanationForEvent,
  rankLifeAreas,
  scoreTransitEvents,
  type TransitEvent,
} from "./ruleset";
import type { TransitObservation } from "./types";

function obs(partial: Partial<TransitObservation> & { planet: TransitObservation["planet"] }): TransitObservation {
  return { sign: "aries", retrograde: false, natalAspects: [], ...partial };
}

describe("scoreTransitEvents", () => {
  it("scores a tight conjunction higher than a wide trine", () => {
    const transits = [
      obs({ planet: "venus", natalAspects: [{ natal: "moon", type: "conjunction", orb: 0.5 }] }),
      obs({ planet: "mars", natalAspects: [{ natal: "sun", type: "trine", orb: 6 }] }),
    ];
    const events = scoreTransitEvents(transits);
    expect(events[0].score).toBeGreaterThan(events[1].score);
    expect(events[0].transit).toBe("venus");
  });

  it("ignores outer-to-outer transits (not personally resonant today)", () => {
    const events = scoreTransitEvents([
      obs({ planet: "pluto", natalAspects: [{ natal: "neptune", type: "sextile", orb: 1 }] }),
    ]);
    expect(events).toHaveLength(0);
  });

  it("boosts retrograde transits", () => {
    const direct = scoreTransitEvents([
      obs({ planet: "mercury", natalAspects: [{ natal: "sun", type: "conjunction", orb: 1 }] }),
    ])[0].score;
    const retro = scoreTransitEvents([
      obs({ planet: "mercury", retrograde: true, natalAspects: [{ natal: "sun", type: "conjunction", orb: 1 }] }),
    ])[0].score;
    expect(retro).toBeGreaterThan(direct);
  });

  it("maps venus→love/money and moon→home/family per the ruleset", () => {
    const events = scoreTransitEvents([
      obs({ planet: "venus", natalAspects: [{ natal: "sun", type: "sextile", orb: 1 }] }),
      obs({ planet: "sun", natalAspects: [{ natal: "moon", type: "conjunction", orb: 1 }] }),
    ]);
    const venusEvent = events.find((e) => e.transit === "venus")!;
    expect(venusEvent.areas).toContain("love");
    const moonEvent = events.find((e) => e.natal === "moon")!;
    expect(moonEvent.areas).toContain("home");
    expect(moonEvent.areas).toContain("family");
  });
});

describe("rankLifeAreas", () => {
  it("ranks the area of the strongest event hottest", () => {
    const events: TransitEvent[] = [
      { transit: "venus", natal: "sun", type: "conjunction", orb: 0.5, retrograde: false, areas: ["love", "money", "self"], score: 3.6 },
      { transit: "mars", natal: "saturn", type: "square", orb: 5, retrograde: false, areas: ["work", "self", "money"], score: 1.6 },
    ];
    const ranked = rankLifeAreas(events);
    // money accumulates from BOTH events (2.8125 + ... ) and outscores
    // love's single hit — that's the ruleset working as designed: areas
    // fed by more active events rank hotter.
    expect(ranked[0].area).toBe("money");
    expect(ranked[0].temperature).toBe("hot");
    expect(ranked.find((r) => r.area === "work")?.temperature).toBe("warm");
    expect(ranked.find((r) => r.area === "love")?.temperature).toBe("hot");
  });

  it("never returns percentages — temperatures only", () => {
    const events: TransitEvent[] = [
      { transit: "sun", natal: "moon", type: "trine", orb: 2, retrograde: false, areas: ["self", "home", "family"], score: 1.7 },
    ];
    for (const r of rankLifeAreas(events)) {
      expect(["hot", "warm", "quiet"]).toContain(r.temperature);
    }
  });
});

describe("event-driven copy selection", () => {
  const events: TransitEvent[] = [
    { transit: "venus", natal: "moon", type: "conjunction", orb: 0.5, retrograde: false, areas: ["love"], score: 3.7 },
    { transit: "mars", natal: "sun", type: "square", orb: 3, retrograde: false, areas: ["work"], score: 1.6 },
  ];

  it("dos trace to the transiting planet of a real event", () => {
    const dos = dosForEvents(events);
    expect(dos.length).toBeGreaterThan(0);
    // venus dos mention warmth/affection themes; every dos string must
    // come from the venus or mars pools (the event planets). We assert
    // membership rather than re-implement selection.
    const venusPool = ["Say the warm thing out loud.", "Plan one small ritual together."];
    const marsPool = ["Start with the hardest task.", "Move your body before you negotiate."];
    for (const d of dos) {
      expect([...venusPool, ...marsPool]).toContain(d);
    }
  });

  it("donts trace to the aspect family of a real event", () => {
    const donts = dontsForEvents(events);
    expect(donts.length).toBeGreaterThan(0);
    const conjunctionPool = ["Don't pile one more thing onto a full day."];
    const squarePool = ["Don't force a door that pushes back.", "Don't mistake friction for failure."];
    for (const d of donts) {
      expect([...conjunctionPool, ...squarePool]).toContain(d);
    }
  });

  it("retrograde events add the planet's retrograde dont", () => {
    const retroEvents: TransitEvent[] = [
      { transit: "mercury", natal: "sun", type: "conjunction", orb: 1, retrograde: true, areas: ["work"], score: 3 },
    ];
    const donts = dontsForEvents(retroEvents);
    expect(donts).toContain("Don't sign what you haven't read twice.");
  });

  it("explanation names both bodies without certainty inflation", () => {
    const line = explanationForEvent(events[0]);
    expect(line).toMatch(/Venus/);
    expect(line).toMatch(/natal Moon/);
    expect(line).not.toMatch(/will definitely|guaranteed|destined/i);
  });
});
