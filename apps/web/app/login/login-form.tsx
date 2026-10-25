"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { fontMono, fontSerif } from "@/app/fonts";

/**
 * Supabase password sign-in/up — the pre-Clerk flow, kept verbatim as
 * the fallback path (local dev, CI, and any user before migration).
 */
export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (mode === "signup") {
      router.push("/onboarding");
    } else {
      router.push("/day");
      router.refresh();
    }
  }

  return (
    <main className="container">
      <Brand />
      <form onSubmit={submit} className="card">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
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
      <ModeToggle mode={mode} onToggle={() => setMode(mode === "signin" ? "signup" : "signin")} />
    </main>
  );
}

export function Brand() {
  return (
    <>
      <h1
        className={`type-display t-36 ${fontSerif.className}`}
        style={{ margin: "var(--space-8) 0 var(--space-2)" }}
      >
        Star Sign
      </h1>
      <p
        className={`type-mono t-13 ${fontMono.className}`}
        style={{ color: "var(--ink-secondary)", marginBottom: "var(--space-6)" }}
      >
        A PRIVATE SKY SHARED WITH SOMEONE YOU CARE ABOUT.
      </p>
    </>
  );
}

export function ModeToggle({
  mode,
  onToggle,
}: {
  mode: "signin" | "signup";
  onToggle: () => void;
}) {
  return (
    <p
      className={`type-mono t-13 ${fontMono.className}`}
      style={{ color: "var(--ink-secondary)", textAlign: "center", marginTop: "var(--space-4)" }}
    >
      {mode === "signin" ? "NEW HERE? " : "ALREADY HAVE AN ACCOUNT? "}
      <a
        href="#"
        className="ui-focusable"
        style={{
          color: "var(--ink)",
          textDecoration: "underline",
          textUnderlineOffset: "3px",
        }}
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
      >
        {mode === "signin" ? "CREATE AN ACCOUNT" : "SIGN IN"}
      </a>
    </p>
  );
}
