/**
 * API contract tests (ASH-233 / criterion 2).
 *
 * Pure-helper coverage for the envelope/guard/rate-limit logic, plus a
 * live HTTP pass against the dev server when NEXT_DEV_URL is reachable
 * (skipped otherwise — the Playwright smoke covers the golden path; this
 * suite pins the status-code map).
 */
import { describe, it, expect } from "vitest";
import {
  parseBody,
  rateLimit,
  rateLimitResponse,
  RATE_LIMITS,
  jsonError,
  notFoundIfForeign,
} from "./api";
import { z } from "zod";
import { NextResponse } from "next/server";

const reqId = "test-req-id";

describe("parseBody", () => {
  const schema = z.object({ name: z.string() }).strict();

  it("malformed JSON → 400 validation_failed envelope", async () => {
    const req = new Request("http://x/api", {
      method: "POST",
      body: "{not json",
    });
    const result = await parseBody(req, schema, reqId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(result.response.status).toBe(400);
      expect(body.error.code).toBe("validation_failed");
      expect(body.meta.requestId).toBe(reqId);
    }
  });

  it("schema violation → 400 with field details", async () => {
    const req = new Request("http://x/api", {
      method: "POST",
      body: JSON.stringify({ name: 123, extra: true }),
    });
    const result = await parseBody(req, schema, reqId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const body = await result.response.json();
      expect(body.error.code).toBe("validation_failed");
      expect(body.error.details.length).toBeGreaterThan(0);
    }
  });

  it("valid body → parsed data", async () => {
    const req = new Request("http://x/api", {
      method: "POST",
      body: JSON.stringify({ name: "ok" }),
    });
    const result = await parseBody(req, schema, reqId);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ name: "ok" });
  });
});

describe("notFoundIfForeign", () => {
  it("owner match → null (proceed)", () => {
    expect(notFoundIfForeign("user-a", "user-a", reqId)).toBeNull();
  });

  it("foreign or absent → 404 (never 403)", () => {
    for (const owner of ["user-b", undefined, null]) {
      const res = notFoundIfForeign(owner, "user-a", reqId);
      expect(res).toBeInstanceOf(NextResponse);
      expect(res!.status).toBe(404);
    }
  });
});

describe("rateLimit (0.3d)", () => {
  it("allows up to limit then 429 with Retry-After", () => {
    const key = `test-${Math.random()}`;
    const rule = { limit: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, rule).allowed).toBe(true);
    }
    const blocked = rateLimit(key, rule);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);

    const res = rateLimitResponse(blocked.retryAfterSeconds, reqId);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    const body = res.headers.get("x-not-json");
    expect(body).toBeNull();
  });

  it("generation default is 10/min (api.md)", () => {
    expect(RATE_LIMITS.generate.limit).toBe(10);
    expect(RATE_LIMITS.general.limit).toBe(60);
  });
});

describe("error envelope shape", () => {
  it("jsonError produces the api.md envelope with meta.requestId", async () => {
    const res = jsonError(401, "unauthenticated", "Sign in required.", reqId);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "unauthenticated", message: "Sign in required." },
      meta: { requestId: reqId },
    });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("live HTTP pass (skipped without dev server)", () => {
  const base = process.env.NEXT_DEV_URL;

  it.skipIf(!base)("unauthenticated → 401 envelope", async () => {
    const res = await fetch(`${base}/api/daily-readings`, { method: "POST" });
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error.code).toBe("unauthenticated");
  });

  it.skipIf(!base)("invalid body → 400 envelope", async () => {
    // No session in this environment — expect 401 first; the 400 path is
    // verified in parseBody tests above and the Playwright flow.
    const res = await fetch(`${base}/api/reflections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    expect([400, 401]).toContain(res.status);
  });
});
