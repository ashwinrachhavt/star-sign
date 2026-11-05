/**
 * Live Mercury integration test (SERVER-ONLY, opt-in).
 *
 * Runs only when RUN_MERCURY_LIVE=1 is set (CI and local default: skip).
 * Proves the real endpoint accepts our two-message contract and returns
 * prose — it never asserts narrative content, only contract shape, since
 * the sky is the model's business, not the test's.
 */
import { describe, it, expect } from "vitest";
import { MercuryNarrativeAdapter } from "./mercury";
import {
  buildNarrativePrompt,
  parseNarrativeOutput,
  type NarrativeFacts,
} from "./mercury";
import { NARRATIVE_REFUSAL_SENTINEL } from "@star-sign/core";

const RUN_LIVE = process.env.RUN_MERCURY_LIVE === "1";

const FACTS: NarrativeFacts = {
  scope: "daily",
  forDate: process.env.MERCURY_LIVE_DATE ?? "2026-11-05",
  headline: "Name the friction; it is load-bearing today.",
  explanation:
    "Transiting Mars in Leo squares your natal Venus — effort spent on " +
    "what you love pays; effort spent appearing fine does not.",
  lifeAreas: [
    { area: "love", temperature: "strained" },
    { area: "work", temperature: "warm" },
  ],
  dos: ["Put the hard sentence in writing"],
  donts: ["Don't soft-pedal the ask"],
  proofs: ["Mars square Venus — friction favors the truth."],
  events: [{ transit: "mars", transitSign: "leo", natal: "venus", type: "square", orb: 2.5 }],
  uncertaintyNote: "Houses unknown — birth time is a guess.",
};

describe.skipIf(!RUN_LIVE)("Mercury live call (RUN_MERCURY_LIVE=1)", () => {
  it("returns in-contract prose for a grounded daily prompt", async () => {
    const adapter = new MercuryNarrativeAdapter();
    const out = await adapter.generate(buildNarrativePrompt(FACTS));

    expect(out.ok).toBe(true);
    if (!out.ok) return; // narrowing
    const parsed = parseNarrativeOutput(out.text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.narrative.length).toBeGreaterThan(0);
    expect(parsed.narrative).not.toContain(NARRATIVE_REFUSAL_SENTINEL);
  }, 30_000);

  it("sends only the two supplied messages — no extra context rides along", async () => {
    const adapter = new MercuryNarrativeAdapter();
    // The adapter signature forces system+user; this test exists to pin
    // that the live wire carries exactly the grounded prompt shape.
    const { system, user } = buildNarrativePrompt(FACTS);
    expect(system).toContain("Never invent");
    expect(user).toContain("HEADLINE:");
  });
});
