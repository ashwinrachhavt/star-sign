"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { fontMono } from "@/app/fonts";

/**
 * Consent actions (ASH-258): accept / decline for recipients; disconnect
 * / withdraw for requesters. Copy per copy.md — plain, no fear, no
 * pressure. Immediate effect on every action.
 *
 * W2: on accepted connections, the daily-updates grant toggle — the
 * viewer's OWN grant (whether the other person sees their daily theme).
 * Each party flips only their own side; the trigger (migration 0015)
 * enforces that at the table.
 */
export default function ConsentActions({
  connectionId,
  isRecipient,
  state,
  otherName,
  shareDailyUpdates: initialShareDailyUpdates,
}: {
  connectionId: string;
  isRecipient: boolean;
  state: string;
  otherName: string;
  shareDailyUpdates: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shareDailyUpdates, setShareDailyUpdates] = useState(
    initialShareDailyUpdates,
  );

  async function call(method: "PUT" | "DELETE" | "PATCH", path = "", body?: unknown) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/connections/${connectionId}${path}`, {
      method,
      ...(body !== undefined
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    setBusy(false);
    if (!res.ok && res.status !== 204) {
      const json = await res.json().catch(() => null);
      setError(json?.error?.message ?? "Something went wrong.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function toggleShare() {
    const next = !shareDailyUpdates;
    setShareDailyUpdates(next); // optimistic; reverted if the PATCH fails
    const ok = await call("PATCH", "", { shareDailyUpdates: next });
    if (!ok) setShareDailyUpdates(!next);
  }

  if (state === "accepted") {
    return (
      <div style={{ marginTop: "var(--space-5)" }}>
        <p className="type-prose t-15" style={{ color: "var(--ink-secondary)" }}>
          You&apos;re connected. Charts are shared both ways.
        </p>
        <div style={{ display: "flex", gap: "var(--space-5)", marginTop: "var(--space-4)" }}>
          <Button variant="link" href={`/connections/${connectionId}/chart`}>
            View their chart
          </Button>
          <button
            className="ui-button-link ui-focusable type-micro-label t-13"
            disabled={busy}
            onClick={() => call("DELETE")}
            style={{ color: "var(--ink-secondary)" }}
          >
            Disconnect
          </button>
        </div>

        {/* The viewer's own daily-updates grant (W2). Toggling off takes
            effect immediately — the friend-updates feed rechecks per read. */}
        <div className="card" style={{ marginTop: "var(--space-5)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)" }}>
            <span
              className={`type-micro-label t-11 ${fontMono.className}`}
              style={{ color: "var(--ink-secondary)" }}
            >
              SHARE MY DAILY UPDATES
            </span>
            <button
              className="ui-button-link ui-focusable type-micro-label t-13"
              disabled={busy}
              onClick={toggleShare}
              aria-pressed={shareDailyUpdates}
              style={{ color: shareDailyUpdates ? "var(--ink)" : "var(--ink-tertiary)" }}
            >
              {shareDailyUpdates ? "ON" : "OFF"}
            </button>
          </div>
          <p className="type-prose t-15" style={{ color: "var(--ink-tertiary)", marginTop: "var(--space-3)" }}>
            {shareDailyUpdates
              ? `${otherName} sees your daily theme on their People page — the theme only, never your birth details.`
              : `${otherName} doesn't see your daily updates right now. Charts stay shared.`}
          </p>
        </div>

        {error && <p className="form-error type-prose t-15">{error}</p>}
      </div>
    );
  }

  if (state !== "requested") {
    return (
      <div style={{ marginTop: "var(--space-5)" }}>
        <p className="type-prose t-15" style={{ color: "var(--ink-tertiary)" }}>
          This connection has ended. Nothing is shared.
        </p>
        {error && <p className="form-error type-prose t-15">{error}</p>}
      </div>
    );
  }

  if (isRecipient) {
    return (
      <div style={{ marginTop: "var(--space-5)" }}>
        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Button
            variant="solid"
            disabled={busy}
            onClick={() => call("PUT", "/acceptance")}
          >
            {busy ? "…" : "Accept — share charts both ways"}
          </Button>
          <button
            className="ui-button-link ui-focusable type-micro-label t-13"
            disabled={busy}
            onClick={() => call("DELETE")}
            style={{ color: "var(--ink-secondary)" }}
          >
            No thanks
          </button>
        </div>
        {error && <p className="form-error type-prose t-15">{error}</p>}
        {notice && <p className="form-status type-prose t-15">{notice}</p>}
      </div>
    );
  }

  return (
    <div style={{ marginTop: "var(--space-5)" }}>
      <p className="type-prose t-15" style={{ color: "var(--ink-secondary)" }}>
        Waiting for their answer. You can withdraw the request at any time.
      </p>
      <div style={{ marginTop: "var(--space-4)" }}>
        <button
          className="ui-button-link ui-focusable type-micro-label t-13"
          disabled={busy}
          onClick={() => call("DELETE")}
          style={{ color: "var(--ink-secondary)" }}
        >
          Withdraw request
        </button>
      </div>
      {error && <p className="form-error type-prose t-15">{error}</p>}
    </div>
  );
}
