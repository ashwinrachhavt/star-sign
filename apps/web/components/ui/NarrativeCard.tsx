"use client";

/**
 * NarrativeCard — the grounded AI narrative (launch wave 1).
 *
 * Fetches POST /api/narratives on mount and renders the narrator's prose.
 * Honesty rules (hallmark polish pass, locked): while pending, a quiet
 * aria-live line; on a null narrative — refusal, provider down, rate
 * limit, or a premium gate — the card renders NOTHING. The deterministic
 * reading above it already carries the day; an empty narrative slot is
 * the truthful state, never a fabricated stand-in.
 */
import { useEffect, useState } from "react";
import { fontMono } from "@/app/fonts";

type NarrativeState =
  | { status: "pending" }
  | { status: "done"; text: string | null };

export function NarrativeCard({
  scope,
  date,
}: {
  scope: "daily" | "week";
  /** Optional date override (YYYY-MM-DD); defaults to the account-local today. */
  date?: string;
}) {
  const [state, setState] = useState<NarrativeState>({ status: "pending" });

  useEffect(() => {
    // State updates land only in the async callbacks — a scope or date
    // change (none today: each page passes a constant) would briefly
    // show the previous text, so callers key the card per surface.
    let alive = true;
    fetch("/api/narratives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(date ? { scope, date } : { scope }),
    })
      .then(async (res) => {
        if (!res.ok) return null; // gate (403) / throttle (429) / error
        const body = (await res.json()) as {
          data?: { narrative?: string | null };
        };
        return body.data?.narrative ?? null;
      })
      .then((text) => {
        // Network failure or a non-2xx: the deterministic surface
        // stands alone.
        if (alive) setState({ status: "done", text });
      })
      .catch(() => {
        if (alive) setState({ status: "done", text: null });
      });
    return () => {
      alive = false;
    };
  }, [scope, date]);

  if (state.status === "done" && !state.text) return null;

  return (
    <section
      className="card"
      style={{ marginTop: "var(--space-5)" }}
      aria-label="Narrative for this reading"
      data-testid="ai-narrative"
    >
      <p
        className={`type-micro-label t-11 ${fontMono.className}`}
        style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-2)" }}
      >
        The sky, restated
      </p>
      <p
        aria-live="polite"
        className="type-prose t-15"
        style={{ lineHeight: 1.7, margin: 0 }}
      >
        {state.status === "pending" ? "Reading the sky…" : state.text}
      </p>
      {state.status === "done" && state.text && (
        <p
          className={`type-mono t-11 ${fontMono.className}`}
          style={{ color: "var(--ink-tertiary)", marginTop: "var(--space-3)" }}
        >
          Restated from the chart facts above — the sky describes, it never
          predicts.
        </p>
      )}
    </section>
  );
}
