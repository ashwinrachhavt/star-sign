"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * OAuth return path (ASH-231 / 0.1a). Clerk redirects here after the
 * hosted Google/Apple flow with the session already established; the
 * Clerk cookie is set, so a refresh of the destination picks it up.
 * The app-level ClerkProvider only mounts when Clerk is configured, so
 * this page deliberately avoids Clerk hooks (which would break the
 * prerender pass in fallback mode) and just forwards.
 */
export default function SsoCallbackPage() {
  const router = useRouter();
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Give Clerk's callback handler a beat to settle cookies, then
    // forward. Destination is always the day page (sign-in) or
    // onboarding (sign-up) — both re-derive state server-side.
    const t = setTimeout(() => {
      setDone(true);
      router.replace(window.location.hash.includes("signup") ? "/onboarding" : "/day");
    }, 500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main className="container">
      <p className="type-prose t-17" style={{ marginTop: "var(--space-8)" }}>
        {done ? "Redirecting…" : "Finishing sign-in…"}
      </p>
    </main>
  );
}
