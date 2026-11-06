import { describe, expect, it } from "vitest";
import { candidateQueries, expandCountry } from "./geocode";

describe("candidateQueries (Open-Meteo requires full country names)", () => {
  it("expands short country forms people actually type", () => {
    expect(candidateQueries("Los Angeles, USA")).toEqual([
      "Los Angeles, USA",
      "Los Angeles, United States",
      "Los Angeles",
    ]);
  });

  it("prefers city + region over city + country when both are present", () => {
    expect(candidateQueries("Springfield, Illinois, USA")).toEqual([
      "Springfield, Illinois, USA",
      "Springfield, Illinois",
      "Springfield, United States",
      "Springfield",
    ]);
  });

  it("keeps a query the provider already understands first", () => {
    expect(candidateQueries("Pune, Maharashtra, India.")[0]).toBe(
      "Pune, Maharashtra, India",
    );
  });

  it("leaves a single place name untouched", () => {
    expect(candidateQueries("  Pune  ")).toEqual(["Pune"]);
  });

  it("drops empty segments and never duplicates a candidate", () => {
    const list = candidateQueries("Pune, , India");
    expect(list).toEqual(["Pune, India", "Pune"]);
    expect(new Set(list.map((q) => q.toLowerCase())).size).toBe(list.length);
  });

  it("returns an empty plan for blank input", () => {
    expect(candidateQueries("   ")).toEqual([]);
  });
});

describe("expandCountry", () => {
  it("maps the common abbreviations", () => {
    expect(expandCountry("UK")).toBe("United Kingdom");
    expect(expandCountry("U.K.")).toBe("United Kingdom");
    expect(expandCountry("GB")).toBe("United Kingdom");
    expect(expandCountry("U.S.A.")).toBe("United States");
    expect(expandCountry("US")).toBe("United States");
    expect(expandCountry("UAE")).toBe("United Arab Emirates");
  });

  it("passes real country names through", () => {
    expect(expandCountry("India")).toBe("India");
    expect(expandCountry("United States")).toBe("United States");
  });
});
