/**
 * Narrative cache + generation tests (in-memory store, stub adapter).
 *
 * Pins the cache contract: one narrative per (user, scope, forDate,
 * variant); the model is called exactly once per key; rate limiting is
 * consulted only on a cache miss; contract refusals and provider
 * failures degrade to null and never cache; a unique-violation race
 * serves the stored row.
 */
import { describe, it, expect, vi } from "vitest";
import { getOrGenerateNarrative, type NarrativeStore } from "./narrate";
import {
  NullNarrativeAdapter,
  type NarrativeAdapter,
  type NarrativeFacts,
  type NarrativeScope,
  type NarrativePrompt,
} from "./mercury";
import { NARRATIVE_REFUSAL_SENTINEL } from "@star-sign/core";

const FACTS: NarrativeFacts = {
  scope: "daily",
  forDate: "2026-11-05",
  headline: "Lead with the harder ask.",
  explanation: "Mars squares your Venus; the day rewards directness.",
  lifeAreas: [{ area: "love", temperature: "strained" }],
  dos: ["Name the thing"],
  donts: ["Don't circle it"],
  proofs: ["Mars square Venus — friction favors the truth."],
  events: [{ transit: "mars", transitSign: "leo", natal: "venus", type: "square", orb: 2.5 }],
  uncertaintyNote: "Born before noon — houses unknown.",
};

/** In-memory NarrativeStore recording every call. */
function memoryStore(seed?: Record<string, string>) {
  const rows = new Map<string, string>(Object.entries(seed ?? {}));
  const writes: Array<{ key: string; narrative: string; factsDigest: string }> = [];
  let failNextInsertCode: string | undefined;
  const store: NarrativeStore = {
    async findNarrative(userId, scope, forDate, variant) {
      return rows.get(`${userId}|${scope}|${forDate}|${variant}`) ?? null;
    },
    async insertNarrative(row) {
      const key = `${row.userId}|${row.scope}|${row.forDate}|${row.variant}`;
      writes.push({ key, narrative: row.narrative, factsDigest: row.factsDigest });
      if (failNextInsertCode) {
        const code = failNextInsertCode;
        failNextInsertCode = undefined;
        return { ok: false, code };
      }
      rows.set(key, row.narrative);
      return { ok: true };
    },
  };
  return {
    store,
    rows,
    writes,
    setFailNextInsertCode(c: string) {
      failNextInsertCode = c;
    },
  };
}

/** Adapter that records calls and replies from a queue. */
function countingAdapter(replies: Array<{ ok: true; text: string }>) {
  const prompts: NarrativePrompt[] = [];
  let i = 0;
  const adapter: NarrativeAdapter = {
    async generate(prompt) {
      prompts.push(prompt);
      return replies[Math.min(i++, replies.length - 1)];
    },
  };
  return { adapter, prompts, calls: () => i };
}

describe("getOrGenerateNarrative", () => {
  it("first call generates and caches; second call serves the cache without the model", async () => {
    const mem = memoryStore();
    const { adapter, prompts, calls } = countingAdapter([
      { ok: true, text: "Mars squares Venus; say it plainly." },
    ]);

    const first = await getOrGenerateNarrative({
      store: mem.store,
      adapter,
      userId: "u1",
      scope: "daily",
      forDate: "2026-11-05",
      facts: FACTS,
    });
    expect(first).toEqual({
      narrative: "Mars squares Venus; say it plainly.",
      source: "generated",
    });
    expect(calls()).toBe(1);
    expect(mem.writes).toHaveLength(1);
    // Provenance: the stored row carries the facts digest.
    expect(mem.writes[0].factsDigest).toMatch(/^[0-9a-f]{64}$/);

    const second = await getOrGenerateNarrative({
      store: mem.store,
      adapter,
      userId: "u1",
      scope: "daily",
      forDate: "2026-11-05",
      facts: FACTS,
    });
    expect(second).toEqual({
      narrative: "Mars squares Venus; say it plainly.",
      source: "cache",
    });
    expect(calls()).toBe(1); // the model ran exactly once for the key
    expect(mem.writes).toHaveLength(1);
    expect(prompts).toHaveLength(1);
  });

  it("keys differ by user, scope, date, and variant", async () => {
    const mem = memoryStore();
    const { adapter, calls } = countingAdapter([{ ok: true, text: "A line." }]);

    for (const key of [
      { userId: "u1", scope: "daily" as NarrativeScope, forDate: "2026-11-05", variant: undefined },
      { userId: "u2", scope: "daily" as NarrativeScope, forDate: "2026-11-05", variant: undefined },
      { userId: "u1", scope: "week" as NarrativeScope, forDate: "2026-11-05", variant: undefined },
      { userId: "u1", scope: "daily" as NarrativeScope, forDate: "2026-11-06", variant: undefined },
      { userId: "u1", scope: "ask" as NarrativeScope, forDate: "2026-11-05", variant: "qhash" },
      { userId: "u1", scope: "ask" as NarrativeScope, forDate: "2026-11-05", variant: "other" },
    ]) {
      await getOrGenerateNarrative({ store: mem.store, adapter, ...key, facts: FACTS });
    }
    // Six distinct keys → six generations.
    expect(calls()).toBe(6);
    expect(mem.writes).toHaveLength(6);
  });

  it("rate limit is consulted only on a cache miss", async () => {
    const mem = memoryStore({ "u1|daily|2026-11-05|": "Cached narrative." });
    const { adapter, calls } = countingAdapter([{ ok: true, text: "Fresh." }]);
    const admit = vi.fn(() => true);

    const hit = await getOrGenerateNarrative({
      store: mem.store,
      adapter,
      userId: "u1",
      scope: "daily",
      forDate: "2026-11-05",
      facts: FACTS,
      admitGeneration: admit,
    });
    expect(hit.source).toBe("cache");
    expect(admit).not.toHaveBeenCalled();

    const miss = await getOrGenerateNarrative({
      store: mem.store,
      adapter,
      userId: "u1",
      scope: "daily",
      forDate: "2026-11-06",
      facts: FACTS,
      admitGeneration: admit,
    });
    expect(miss.source).toBe("generated");
    expect(admit).toHaveBeenCalledTimes(1);
    expect(calls()).toBe(1);
  });

  it("a declined admission returns rate_limited without calling the model or caching", async () => {
    const mem = memoryStore();
    const { adapter, calls } = countingAdapter([{ ok: true, text: "Never." }]);
    const out = await getOrGenerateNarrative({
      store: mem.store,
      adapter,
      userId: "u1",
      scope: "daily",
      forDate: "2026-11-05",
      facts: FACTS,
      admitGeneration: () => false,
    });
    expect(out).toEqual({ narrative: null, source: "rate_limited" });
    expect(calls()).toBe(0);
    expect(mem.writes).toHaveLength(0);
  });

  it("provider failure degrades to null and never caches", async () => {
    const mem = memoryStore();
    const failing: NarrativeAdapter = {
      async generate() {
        return { ok: false as const, reason: "mercury_http_503" };
      },
    };
    const out = await getOrGenerateNarrative({
      store: mem.store,
      adapter: failing,
      userId: "u1",
      scope: "daily",
      forDate: "2026-11-05",
      facts: FACTS,
    });
    expect(out).toEqual({ narrative: null, source: "unavailable" });
    expect(mem.writes).toHaveLength(0);
  });

  it("the model's refusal sentinel degrades to null and never caches", async () => {
    const mem = memoryStore();
    const { adapter, calls } = countingAdapter([
      { ok: true, text: NARRATIVE_REFUSAL_SENTINEL },
    ]);
    const out = await getOrGenerateNarrative({
      store: mem.store,
      adapter,
      userId: "u1",
      scope: "daily",
      forDate: "2026-11-05",
      facts: FACTS,
    });
    expect(out).toEqual({ narrative: null, source: "refused" });
    expect(calls()).toBe(1); // the model was asked — and answered with the sentinel
    expect(mem.writes).toHaveLength(0); // refusals are not cached
  });

  it("out-of-contract output (predictions) is refused, never served", async () => {
    const mem = memoryStore();
    const { adapter } = countingAdapter([
      { ok: true, text: "Big week. You will meet someone and it will change everything." },
    ]);
    const out = await getOrGenerateNarrative({
      store: mem.store,
      adapter,
      userId: "u1",
      scope: "week",
      forDate: "2026-11-05",
      facts: {
        scope: "week",
        startDate: "2026-11-05",
        endDate: "2026-11-11",
        quiet: false,
        days: [
          {
            date: "2026-11-05",
            events: [{ transit: "mars", natal: "venus", type: "square", orb: 2.5 }],
          },
        ],
      },
    });
    expect(out).toEqual({ narrative: null, source: "refused" });
    expect(mem.writes).toHaveLength(0);
  });

  it("a unique-violation race reads back the winner's row", async () => {
    const mem = memoryStore();
    mem.setFailNextInsertCode("23505");
    // The race winner stored first; the readback finds it.
    mem.rows.set("u1|daily|2026-11-05|", "Won the race.");
    const { adapter } = countingAdapter([{ ok: true, text: "Lost the race." }]);
    const out = await getOrGenerateNarrative({
      store: mem.store,
      adapter,
      userId: "u1",
      scope: "daily",
      forDate: "2026-11-05",
      facts: FACTS,
    });
    expect(out).toEqual({ narrative: "Won the race.", source: "cache" });
  });

  it("NullNarrativeAdapter stands in for tests (push-adapter precedent)", async () => {
    const mem = memoryStore();
    const adapter = new NullNarrativeAdapter();
    const out = await getOrGenerateNarrative({
      store: mem.store,
      adapter,
      userId: "u1",
      scope: "daily",
      forDate: "2026-11-05",
      facts: FACTS,
    });
    expect(out.source).toBe("generated");
    expect(out.narrative).toBeTruthy();
    expect(adapter.sent).toHaveLength(1);
  });
});
