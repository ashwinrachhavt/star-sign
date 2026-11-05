import { describe, expect, it } from "vitest";
import {
  describeAuthError,
  describeBlockedStatus,
  planAuthStep,
} from "./clerk-auth-flow";

describe("planAuthStep — sign-up", () => {
  it("completes immediately when no verification is required (Verify-at-sign-up off)", () => {
    expect(planAuthStep("signup", "complete")).toEqual({
      kind: "complete",
      redirectTo: "/onboarding",
    });
  });

  it("routes missing_requirements into the email-code step", () => {
    expect(planAuthStep("signup", "missing_requirements")).toEqual({
      kind: "verify-email-code",
    });
  });

  it("surfaces an unexpected status instead of a canned message", () => {
    expect(planAuthStep("signup", "abandoned")).toEqual({
      kind: "blocked",
      status: "abandoned",
    });
  });
});

describe("planAuthStep — sign-in", () => {
  it("completes to /day when the session exists", () => {
    expect(planAuthStep("signin", "complete")).toEqual({
      kind: "complete",
      redirectTo: "/day",
    });
  });

  it("routes needs_first_factor into the email-code step", () => {
    expect(planAuthStep("signin", "needs_first_factor")).toEqual({
      kind: "verify-email-code",
    });
  });

  it("accepts missing_requirements on the sign-in resource defensively", () => {
    expect(planAuthStep("signin", "missing_requirements")).toEqual({
      kind: "verify-email-code",
    });
  });

  it("blocks on statuses this form cannot act on, with the status surfaced", () => {
    for (const status of ["needs_identifier", "needs_second_factor", "needs_new_password"]) {
      expect(planAuthStep("signin", status)).toEqual({ kind: "blocked", status });
    }
  });
});

describe("describeBlockedStatus", () => {
  it("names the flow and embeds the actual Clerk status", () => {
    expect(describeBlockedStatus("signup", "abandoned")).toBe(
      "Sign-up needs another step (Clerk status: abandoned).",
    );
    expect(describeBlockedStatus("signin", "needs_second_factor")).toBe(
      "Sign-in needs another step (Clerk status: needs_second_factor).",
    );
  });
});

describe("describeAuthError", () => {
  it("surfaces the first Clerk API error with its stable code", () => {
    const err = {
      status: 422,
      errors: [
        { code: "form_code_incorrect", message: "Incorrect code.", meta: { param: "code" } },
      ],
    };
    expect(describeAuthError(err, "Verification failed.")).toBe(
      "Incorrect code. (Clerk: form_code_incorrect)",
    );
  });

  it("uses the Clerk message alone when no code is present", () => {
    expect(describeAuthError({ errors: [{ message: "Session expired." }] }, "x")).toBe(
      "Session expired.",
    );
  });

  it("falls back to Error.message for non-Clerk errors", () => {
    expect(describeAuthError(new Error("network down"), "Authentication failed.")).toBe(
      "network down",
    );
  });

  it("falls back to the given copy for unknown shapes", () => {
    expect(describeAuthError(undefined, "Authentication failed.")).toBe(
      "Authentication failed.",
    );
    expect(describeAuthError({ errors: "garbage" }, "Sign-up failed.")).toBe("Sign-up failed.");
  });
});
