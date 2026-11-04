import { describe, expect, it } from "vitest";
import { parseLifeAreas } from "./readings";

describe("parseLifeAreas (ASH-268)", () => {
  it("parses the new {area, temperature} shape", () => {
    expect(
      parseLifeAreas([
        { area: "work", temperature: "hot" },
        { area: "love", temperature: "quiet" },
      ]),
    ).toEqual([
      { area: "work", temperature: "hot" },
      { area: "love", temperature: "quiet" },
    ]);
  });

  it("maps old string-array rows to temperature 'legacy' (UI renders the honest '—')", () => {
    // Old rows cannot recover their computed temperature; marking them
    // legacy keeps the area name and the UI shows the dash — never a
    // fabricated "quiet".
    expect(parseLifeAreas(["self", "money"])).toEqual([
      { area: "self", temperature: "legacy" },
      { area: "money", temperature: "legacy" },
    ]);
  });

  it("drops malformed entries instead of throwing", () => {
    expect(parseLifeAreas([{ area: "work" }, 42, null, { area: 7, temperature: "hot" }])).toEqual([]);
    expect(parseLifeAreas("not-an-array")).toEqual([]);
    expect(parseLifeAreas(undefined)).toEqual([]);
  });

  it("rejects unknown temperature values", () => {
    expect(parseLifeAreas([{ area: "work", temperature: "scorching" }])).toEqual([]);
  });
});
