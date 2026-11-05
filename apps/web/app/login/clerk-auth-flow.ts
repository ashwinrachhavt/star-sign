/**
 * Clerk multi-step auth status machine for the custom login form.
 *
 * Why this exists: Clerk's signUp/signIn resources are multi-step, and the
 * form used to collapse every non-complete status into a canned "check
 * your email" string — the real status was discarded and no code-input
 * step ever rendered, so sign-ups stalled whenever the instance's
 * "Verify at sign-up" toggle was ON (status `missing_requirements`).
 *
 * Status unions are from the installed @clerk/shared types:
 *   SignUpStatus = 'missing_requirements' | 'complete' | 'abandoned'
 *   SignInStatus = 'needs_identifier' | 'needs_first_factor'
 *                | 'needs_second_factor' | 'needs_new_password' | 'complete'
 * The two resources verify differently: SignUpResource exposes
 * prepareVerification/attemptVerification, while SignInResource has no
 * such methods — its email-code path runs through prepareFirstFactor/
 * attemptFirstFactor against a specific emailAddressId.
 */

/** Which credential flow is in flight; decides the completion redirect. */
export type AuthFlow = "signin" | "signup";

/** What the form should do with a Clerk attempt status. */
export type AuthStepPlan =
  /** The session exists — leave for the flow's destination. */
  | { kind: "complete"; redirectTo: string }
  /** The address needs an emailed code before the flow can complete. */
  | { kind: "verify-email-code" }
  /** Nothing further this form can do — surface the actual status. */
  | { kind: "blocked"; status: string };

/** Where each flow lands once its Clerk session exists. */
export const AUTH_REDIRECT: Record<AuthFlow, string> = {
  signin: "/day",
  signup: "/onboarding",
};

/**
 * Map a Clerk attempt status onto the next form step. Verification is
 * optional by instance configuration: when "Verify at sign-up" is off,
 * signUp.create already returns `complete` and the form must finish
 * immediately — this makes that branch explicit and testable.
 */
export function planAuthStep(flow: AuthFlow, status: string): AuthStepPlan {
  if (status === "complete") {
    return { kind: "complete", redirectTo: AUTH_REDIRECT[flow] };
  }
  // Sign-up: the "Verify at sign-up" toggle parks create() here.
  // Sign-in: an unverified address resurfaces as a first-factor step
  // (and 'missing_requirements' is accepted defensively — Clerk uses it
  // for the same situation on some responses).
  const wantsEmailCode =
    flow === "signup"
      ? status === "missing_requirements"
      : status === "needs_first_factor" || status === "missing_requirements";
  if (wantsEmailCode) return { kind: "verify-email-code" };
  return { kind: "blocked", status };
}

/**
 * Human message for a status the form cannot act on. The point is to
 * surface the ACTUAL Clerk status — never a canned string.
 */
export function describeBlockedStatus(flow: AuthFlow, status: string): string {
  return `${flow === "signin" ? "Sign-in" : "Sign-up"} needs another step (Clerk status: ${status}).`;
}

interface ClerkAPIErrorLike {
  code?: string;
  message: string;
}

/** Clerk failures carry an `errors` array (message + stable code), not plain Error semantics. */
function firstClerkError(err: unknown): ClerkAPIErrorLike | null {
  if (typeof err !== "object" || err === null || !("errors" in err)) return null;
  const errors = (err as { errors?: unknown }).errors;
  if (!Array.isArray(errors)) return null;
  const first = errors.find(
    (e): e is ClerkAPIErrorLike =>
      typeof e === "object" && e !== null && typeof (e as { message?: unknown }).message === "string",
  );
  return first ?? null;
}

/**
 * Extract the most specific message from any thrown auth error: Clerk API
 * errors use their first message + stable code, plain Errors use their
 * message, anything else falls back to the given copy.
 */
export function describeAuthError(err: unknown, fallback: string): string {
  const clerk = firstClerkError(err);
  if (clerk) {
    return clerk.code ? `${clerk.message} (Clerk: ${clerk.code})` : clerk.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
