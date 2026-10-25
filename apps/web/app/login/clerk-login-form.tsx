"use client";

import { useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { Brand, ModeToggle } from "./login-form";

/**
 * Clerk-backed login (ASH-231 / 0.1a): Google + Apple OAuth buttons and
 * email/password through Clerk. Mounted only when Clerk is configured
 * (login/page.tsx gates it), so the hooks are always loaded here.
 */
export default function ClerkLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();

  const clerkReady = signInLoaded && signUpLoaded && !!signIn && !!signUp;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clerkReady || !signIn || !signUp) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        const attempt = await signIn.create({ identifier: email, password });
        if (attempt.status === "complete") {
          router.push("/day");
          router.refresh();
          return;
        }
        setError("Sign-in needs another step; check your email.");
        return;
      }
      const attempt = await signUp.create({ emailAddress: email, password });
      if (attempt.status === "complete") {
        router.push("/onboarding");
        router.refresh();
        return;
      }
      setError("Check your email to finish creating your account.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
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
      setError(err instanceof Error ? err.message : "OAuth failed.");
    }
  }

  return (
    <main className="container">
      <Brand />
      <div className="card">
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
      </div>
      <ModeToggle mode={mode} onToggle={() => setMode(mode === "signin" ? "signup" : "signin")} />
    </main>
  );
}
