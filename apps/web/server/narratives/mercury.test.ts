/**
 * Mercury adapter tests (SERVER-ONLY boundary, mocked fetch).
 *
 * Pins the request shape (endpoint, auth header, model, two-message
 * contract), the key handling (env-only, never in the body), and the
 * failure mapping (HTTP status, empty body, network) — no live network.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  MercuryNarrativeAdapter,
  MERCURY_MODEL,
} from "./mercury";

const PROMPT = {
  system: "You are Star Sign's narrator.",
  user: "SCOPE: daily\nHEADLINE: test",
};

function lastFetchCall(): { url: string; init: RequestInit } {
  const call = vi.mocked(fetch).mock.calls.at(-1)!;
  return { url: call[0] as string, init: call[1] as RequestInit };
}

function mockResponse(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(body === "" ? "" : JSON.stringify(body), { status }),
    ),
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("MercuryNarrativeAdapter", () => {
  it("posts an OpenAI-compatible chat-completions request with the bearer key", async () => {
    vi.stubEnv("MERCURY_API_KEY", "test-key-123");
    mockResponse(200, {
      choices: [{ message: { content: "A grounded line." } }],
    });

    const out = await new MercuryNarrativeAdapter().generate(PROMPT);

    expect(out).toEqual({ ok: true, text: "A grounded line." });
    const { url, init } = lastFetchCall();
    expect(url).toBe("https://api.inceptionlabs.ai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-key-123",
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(MERCURY_MODEL);
    expect(body.messages).toEqual([
      { role: "system", content: PROMPT.system },
      { role: "user", content: PROMPT.user },
    ]);
    // The key is header-only — it must never ride in the request body.
    expect(init.body as string).not.toContain("test-key-123");
  });

  it("fails honestly when the key is not configured", async () => {
    vi.stubEnv("MERCURY_API_KEY", "");
    const out = await new MercuryNarrativeAdapter().generate(PROMPT);
    expect(out).toEqual({ ok: false, reason: "mercury_not_configured" });
  });

  it("maps a non-200 to a failed result, not a throw", async () => {
    vi.stubEnv("MERCURY_API_KEY", "k");
    mockResponse(503, { error: "overloaded" });
    const out = await new MercuryNarrativeAdapter().generate(PROMPT);
    expect(out).toEqual({ ok: false, reason: "mercury_http_503" });
  });

  it("maps an empty completion to a failed result", async () => {
    vi.stubEnv("MERCURY_API_KEY", "k");
    mockResponse(200, { choices: [] });
    const out = await new MercuryNarrativeAdapter().generate(PROMPT);
    expect(out).toEqual({ ok: false, reason: "mercury_empty_response" });
  });

  it("maps a network failure to a failed result", async () => {
    vi.stubEnv("MERCURY_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("socket hangup");
      }),
    );
    const out = await new MercuryNarrativeAdapter().generate(PROMPT);
    expect(out).toEqual({ ok: false, reason: "socket hangup" });
  });
});
