"use client";

import { useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { Brand, ModeToggle } from "./login-form";
import { fontMono } from "@/app/fonts";
import {
  type AuthFlow,
  AUTH_REDIRECT,
  describeAuthError,
  describeBlockedStatus,
  planAuthStep,
} from "./clerk-auth-flow";

/**
 * Clerk-backed login (ASH-231 / 0.1a): Google + Apple OAuth buttons and
 * email/password through Clerk. Mounted only when Clerk is configured
 * (login/page.tsx gates it), so the hooks are always loaded here.
 *
 * Multi-step completion: when the instance's "Verify at sign-up" toggle is
 * on, signUp.create stops at `missing_requirements` and the form renders
 * an emailed-code step (prepareVerification → attemptVerification) before
 * redirecting; sign-in runs the same step through prepareFirstFactor/
 * attemptFirstFactor when its address still needs verification. With the
 * toggle off, create() returns `complete` and the flow finishes
 * immediately — no code step is ever shown.
 */
export default function ClerkLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Non-null while the form sits on the emailed-code step. */
  const [verifyingFlow, setVerifyingFlow] = useState<AuthFlow | null>(null);
  const [code, setCode] = useState("");
  const router = useRouter();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();

  const clerkReady = signInLoaded && signUpLoaded && !!signIn && !!signUp;

  function finish(redirectTo: string) {
    router.push(redirectTo);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clerkReady || !signIn || !signUp) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        const attempt = await signIn.create({ identifier: email, password });
        const plan = planAuthStep("signin", attempt.status ?? "unknown");
        if (plan.kind === "complete") {
          // A complete status is not an active session: activate it or the
          // server sees an anonymous request and bounces to /login.
          await setActiveSignIn({ session: attempt.createdSessionId });
          finish(plan.redirectTo);
          return;
        }
        if (plan.kind === "verify-email-code") {
          // Sign-in email codes target a specific address record.
          const emailCode = attempt.supportedFirstFactors?.find(
            (f) => f.strategy === "email_code",
          );
          const emailAddressId =
            emailCode && "emailAddressId" in emailCode ? emailCode.emailAddressId : null;
          if (!emailAddressId) {
            setError(describeBlockedStatus("signin", attempt.status ?? "unknown"));
            return;
          }
          await signIn.prepareFirstFactor({ strategy: "email_code", emailAddressId });
          setVerifyingFlow("signin");
          return;
        }
        setError(describeBlockedStatus("signin", plan.status));
        return;
      }
      const attempt = await signUp.create({ emailAddress: email, password });
      const plan = planAuthStep("signup", attempt.status ?? "unknown");
      if (plan.kind === "complete") {
        // No verification required (e.g. the "Verify at sign-up" toggle is
        // off) — complete immediately.
        await setActiveSignUp({ session: attempt.createdSessionId });
        finish(plan.redirectTo);
        return;
      }
      if (plan.kind === "verify-email-code") {
        await signUp.prepareVerification({ strategy: "email_code" });
        setVerifyingFlow("signup");
        return;
      }
      setError(describeBlockedStatus("signup", plan.status));
    } catch (err) {
      setError(describeAuthError(err, mode === "signin" ? "Sign-in failed." : "Sign-up failed."));
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!clerkReady || !signIn || !signUp || !verifyingFlow) return;
    setBusy(true);
    setError(null);
    try {
      const attempt =
        verifyingFlow === "signup"
          ? await signUp.attemptVerification({ strategy: "email_code", code })
          : await signIn.attemptFirstFactor({ strategy: "email_code", code });
      if (attempt.status === "complete") {
        // Verified, but a complete status is not an active session; activate
        // before leaving or the server bounces the next request to /login.
        const activation = { session: attempt.createdSessionId };
        if (verifyingFlow === "signup") {
          await setActiveSignUp(activation);
        } else {
          await setActiveSignIn(activation);
        }
        finish(AUTH_REDIRECT[verifyingFlow]);
        return;
      }
      setError(describeBlockedStatus(verifyingFlow, attempt.status ?? "unknown"));
    } catch (err) {
      setError(describeAuthError(err, "Verification failed."));
    } finally {
      setBusy(false);
    }
  }

  async function oauth(strategy: "oauth_google" | "oauth_apple") {
    setError(null);
    if (!clerkReady || !signIn || !signUp) return;
    try {
      if (mode === "signin") {
        await signIn.authenticateWithRedirect({
          strategy,
          redirectUrl: "/sso-callback",
          redirectUrlComplete: "/day",
        });
      } else {
        await signUp.authenticateWithRedirect({
          strategy,
          redirectUrl: "/sso-callback",
          redirectUrlComplete: "/onboarding",
        });
      }
    } catch (err) {
      setError(describeAuthError(err, "OAuth failed."));
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setBusy(true);
    setError(null);
    try {
      const attempt = await signUp.attemptEmailAddressVerification({ code });
      if (attempt.status === "complete") {
        await setActiveSignUp({ session: attempt.createdSessionId });
        router.push("/onboarding");
        router.refresh();
        return;
      }
      setError("That code didn't finish creating the account. Check the email and try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <Brand />
      <div className="card">
        {verifyingFlow ? (
          <form onSubmit={verify}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
              <p
                className={`type-mono t-13 ${fontMono.className}`}
                style={{ color: "var(--ink-secondary)" }}
              >
                {verifyingFlow === "signup"
                  ? `WE EMAILED A 6-DIGIT CODE TO ${email.toUpperCase()}. ENTER IT TO FINISH CREATING YOUR ACCOUNT.`
                  : `WE EMAILED A 6-DIGIT CODE TO ${email.toUpperCase()}. ENTER IT TO FINISH SIGNING IN.`}
              </p>
              <Input
                id="code"
                label="Verification code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              {error && <p className="form-error type-prose t-15">{error}</p>}
              <div>
                <Button type="submit" variant="solid" disabled={busy}>
                  {busy ? "…" : "Verify"}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <Button variant="link" onClick={() => oauth("oauth_google")}>
                Continue with Google
              </Button>
              <Button variant="link" onClick={() => oauth("oauth_apple")}>
                Continue with Apple
              </Button>
            </div>

            <form onSubmit={submit}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-5)",
                  marginTop: "var(--space-5)",
                  paddingTop: "var(--space-5)",
                  borderTop: "1px solid var(--hairline)",
                }}
              >
                <Input
                  id="email"
                  label="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  id="password"
                  label="Password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <p className="form-error type-prose t-15">{error}</p>}
              <div style={{ marginTop: "var(--space-5)" }}>
                <Button type="submit" variant="solid" disabled={busy}>
                  {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
      {!verifyingFlow && (
        <ModeToggle mode={mode} onToggle={() => setMode(mode === "signin" ? "signup" : "signin")} />
      )}
    </main>
  );
}
