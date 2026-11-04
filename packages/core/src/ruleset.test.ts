import { describe, expect, it } from "vitest";
import {
  explanationForEvent,
  guidancePairsForEvents,
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

describe("rankLifeAreas (W2b four-state scale)", () => {
  it("ranks the area of the strongest event hottest — charged absent valence events", () => {
    const events: TransitEvent[] = [
      { transit: "venus", natal: "sun", type: "conjunction", orb: 0.5, retrograde: false, areas: ["love", "money", "self"], score: 3.6 },
      { transit: "mars", natal: "saturn", type: "square", orb: 5, retrograde: false, areas: ["work", "self", "money"], score: 1.6 },
    ];
    const ranked = rankLifeAreas(events);
    // money accumulates from BOTH events and outscores love's single hit —
    // that's the ruleset working as designed: areas fed by more active
    // events rank hottest. Conjunctions carry no valence of their own, so
    // the conjunction-fed areas read charged (activation), not strained.
    expect(ranked[0].area).toBe("money");
    expect(ranked[0].temperature).toBe("charged");
    expect(ranked.find((r) => r.area === "work")?.temperature).toBe("warm");
    expect(ranked.find((r) => r.area === "love")?.temperature).toBe("charged");
  });

  it("reads strained only when friction outweighs harmony in the area's own events", () => {
    const events: TransitEvent[] = [
      { transit: "mars", natal: "saturn", type: "square", orb: 0.5, retrograde: false, areas: ["work", "self"], score: 3.6 },
      { transit: "venus", natal: "sun", type: "trine", orb: 6, retrograde: false, areas: ["work"], score: 1.2 },
    ];
    const ranked = rankLifeAreas(events);
    // work's frictional score (3.6) exceeds its harmonious score (1.2).
    expect(ranked.find((r) => r.area === "work")?.temperature).toBe("strained");
  });

  it("valence balance: a transits-good day cannot read strained (spec W2b)", () => {
    // Harmonious-only sky: every event is a trine or sextile.
    const events: TransitEvent[] = [
      { transit: "venus", natal: "sun", type: "trine", orb: 0.5, retrograde: false, areas: ["love", "money", "self"], score: 3.6 },
      { transit: "mars", natal: "saturn", type: "sextile", orb: 5, retrograde: false, areas: ["work", "self", "money"], score: 1.6 },
      { transit: "mercury", natal: "moon", type: "trine", orb: 1, retrograde: false, areas: ["friends"], score: 2.9 },
    ];
    const ranked = rankLifeAreas(events);
    for (const r of ranked) {
      expect(r.temperature).not.toBe("strained");
    }
  });

  it("never returns percentages — temperatures only, from our own scale", () => {
    const events: TransitEvent[] = [
      { transit: "sun", natal: "moon", type: "trine", orb: 2, retrograde: false, areas: ["self", "home", "family"], score: 1.7 },
    ];
    for (const r of rankLifeAreas(events)) {
      expect(["charged", "warm", "steady", "strained"]).toContain(r.temperature);
    }
  });
});

describe("event-driven copy selection (W2b same-event pairing)", () => {
  const events: TransitEvent[] = [
    { transit: "venus", natal: "moon", type: "conjunction", orb: 0.5, retrograde: false, areas: ["love"], score: 3.7 },
    { transit: "mars", natal: "sun", type: "square", orb: 3, retrograde: false, areas: ["work"], score: 1.6 },
  ];

  it("each pair's do and don't derive from ONE event", () => {
    const pairs = guidancePairsForEvents(events);
    expect(pairs.length).toBeGreaterThan(0);
    const venusPool = ["Say the warm thing out loud.", "Plan one small ritual together."];
    const marsPool = ["Start with the hardest task.", "Move your body before you negotiate."];
    const conjunctionPool = ["Don't pile one more thing onto a full day."];
    const squarePool = ["Don't force a door that pushes back.", "Don't mistake friction for failure."];
    for (const p of pairs) {
      // Both sides trace to the same event — the pairing rule.
      if (p.event.transit === "venus") {
        expect(p.event.type).toBe("conjunction");
        expect(venusPool).toContain(p.do);
        expect(conjunctionPool).toContain(p.dont);
      } else if (p.event.transit === "mars") {
        expect(p.event.type).toBe("square");
        expect(marsPool).toContain(p.do);
        expect(squarePool).toContain(p.dont);
      } else {
        throw new Error(`unexpected event planet ${p.event.transit}`);
      }
    }
  });

  it("does not cross-pair: a conjunction do never carries a square-family don't", () => {
    const pairs = guidancePairsForEvents(events);
    for (const p of pairs) {
      if (p.event.type === "conjunction") {
        expect(p.dont).not.toMatch(/friction for failure|door that pushes back/);
      }
      if (p.event.type === "square") {
        expect(p.dont).not.toBe("Don't pile one more thing onto a full day.");
      }
    }
  });

  it("retrograde events add the planet's retrograde don't to their own pair", () => {
    const retroEvents: TransitEvent[] = [
      { transit: "mercury", natal: "sun", type: "conjunction", orb: 1, retrograde: true, areas: ["work"], score: 3 },
    ];
    const pairs = guidancePairsForEvents(retroEvents);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].dont).toBe("Don't sign what you haven't read twice.");
  });

  it("explanation names both bodies without certainty inflation", () => {
    const line = explanationForEvent(events[0]);
    expect(line).toMatch(/Venus/);
    expect(line).toMatch(/natal Moon/);
    expect(line).not.toMatch(/will definitely|guaranteed|destined/i);
  });
});
