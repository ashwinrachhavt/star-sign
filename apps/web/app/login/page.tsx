"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
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
      <h1 style={{ margin: "48px 0 8px", fontSize: "2rem" }}>Our Sky</h1>
      <p className="muted" style={{ marginBottom: 32 }}>
        A private sky shared with someone you care about.
      </p>
      <form onSubmit={submit} className="card">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p style={{ color: "#f28b82", marginTop: 12, fontSize: "0.9rem" }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="muted" style={{ textAlign: "center" }}>
        {mode === "signin" ? "New here? " : "Already have an account? "}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setMode(mode === "signin" ? "signup" : "signin");
          }}
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </a>
      </p>
    </main>
  );
}
