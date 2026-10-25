import { describe, expect, it } from "vitest";
import { ASPECT_GLYPHS, BODY_GLYPHS, dateRangeLabel } from "@/components/ui/glyphs";

describe("glyphs (ASH-254 AC2)", () => {
  it("covers all 10 bodies with distinct glyphs", () => {
    const bodies = [
      "sun", "moon", "mercury", "venus", "mars",
      "jupiter", "saturn", "uranus", "neptune", "pluto",
    ];
    const glyphs = bodies.map((b) => BODY_GLYPHS[b]);
    for (const g of glyphs) {
      expect(g).toBeTruthy();
      expect(g).not.toBe("•");
    }
    expect(new Set(glyphs).size).toBe(10);
  });

  it("covers all 5 aspect families with distinct glyphs", () => {
    const aspects = ["conjunction", "opposition", "square", "trine", "sextile"];
    const glyphs = aspects.map((a) => ASPECT_GLYPHS[a]);
    for (const g of glyphs) {
      expect(g).toBeTruthy();
      expect(g).not.toBe("·");
    }
    expect(new Set(glyphs).size).toBe(5);
  });
});

describe("dateRangeLabel (ASH-254 scope: mono caps, em-dash)", () => {
  it("formats a single day as one date", () => {
    expect(dateRangeLabel("2026-10-23")).toBe("OCTOBER 23");
  });

  it("formats a range with an em-dash per ref 12.png", () => {
    expect(dateRangeLabel("2026-10-23", "2026-11-07")).toBe("OCTOBER 23—NOVEMBER 7");
  });

  it("collapses a same-day range to one date", () => {
    expect(dateRangeLabel("2026-10-23", "2026-10-23")).toBe("OCTOBER 23");
  });
});
