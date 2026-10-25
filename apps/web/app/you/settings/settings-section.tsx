"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fontMono } from "@/app/fonts";

interface Prefs {
  optFullMoon: boolean | null;
  optRetrograde: boolean | null;
  optWeeklyDigest: boolean | null;
  quietStartHour: number | null;
  quietEndHour: number | null;
}

/**
 * Interactive halves of the Settings tab (ASH-267): notification
 * opt-in toggles (PUT /api/me/notification-preferences), data export
 * (POST /api/account-export → download), sign out, and account deletion
 * (POST /api/account-deletion, confirm-gated).
 */
export function SettingsSection({
  displayName,
  prefs,
}: {
  displayName: string;
  prefs: Prefs | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<Prefs>(
    prefs ?? { optFullMoon: false, optRetrograde: false, optWeeklyDigest: false, quietStartHour: 22, quietEndHour: 8 },
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(next: Prefs) {
    setState(next);
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/me/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optFullMoon: next.optFullMoon,
          optRetrograde: next.optRetrograde,
          optWeeklyDigest: next.optWeeklyDigest,
          quietStartHour: next.quietStartHour,
          quietEndHour: next.quietEndHour,
        }),
      });
      setStatus(res.ok ? "Preferences saved." : "Could not save — try again.");
    } catch {
      setStatus("Could not save — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function exportData() {
    setStatus(null);
    try {
      const res = await fetch("/api/account-export", { method: "POST" });
      if (!res.ok) {
        setStatus("Export failed — try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `star-sign-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Export downloaded.");
    } catch {
      setStatus("Export failed — try again.");
    }
  }

  async function deleteAccount() {
    setStatus(null);
    try {
      const res = await fetch("/api/account-deletion", { method: "POST" });
      if (!res.ok) {
        setStatus("Deletion failed — try again.");
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      setStatus("Deletion failed — try again.");
    }
  }

  const toggles: Array<{ key: keyof Prefs; label: string }> = [
    { key: "optFullMoon", label: "Full & new moon notes" },
    { key: "optRetrograde", label: "Retrograde notes" },
    { key: "optWeeklyDigest", label: "Weekly digest" },
  ];

  return (
    <>
      <section style={{ marginTop: "var(--space-6)" }}>
        <p
          className={`type-micro-label t-11 ${fontMono.className}`}
          style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-3)" }}
        >
          NOTIFICATIONS
        </p>
        <div className="card">
          {toggles.map(({ key, label }) => {
            const on = state[key] === true;
            return (
              <label
                key={key}
                className="ui-focusable"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "var(--space-4)",
                  padding: "var(--space-3) 0",
                  borderBottom: "1px solid var(--hairline)",
                  cursor: "pointer",
                }}
              >
                <span className="type-prose t-15">{label}</span>
                <input
                  type="checkbox"
                  checked={on}
                  disabled={saving}
                  onChange={(e) => save({ ...state, [key]: e.target.checked })}
                  style={{ accentColor: "var(--ink)", width: 20, height: 20 }}
                />
              </label>
            );
          })}
          <p
            className={`type-micro-label t-11 ${fontMono.className}`}
            style={{ color: "var(--ink-tertiary)", marginTop: "var(--space-3)" }}
          >
            QUIET HOURS {String(state.quietStartHour ?? 22).padStart(2, "0")}:00 —{" "}
            {String(state.quietEndHour ?? 8).padStart(2, "0")}:00. EVERYTHING IS OPT-IN AND
            CAN BE TURNED OFF HERE.
          </p>
        </div>
      </section>

      <section style={{ marginTop: "var(--space-6)" }}>
        <p
          className={`type-micro-label t-11 ${fontMono.className}`}
          style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-3)" }}
        >
          YOUR DATA
        </p>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <button
            type="button"
            className="ui-button-link ui-focusable type-micro-label t-11"
            style={{ alignSelf: "flex-start" }}
            onClick={exportData}
          >
            Export my data (JSON)
          </button>
          <p
            className={`type-micro-label t-11 ${fontMono.className}`}
            style={{ color: "var(--ink-tertiary)" }}
          >
            A PRIVATE BUNDLE OF EVERYTHING YOUR ACCOUNT HOLDS.
          </p>
        </div>
      </section>

      <section style={{ marginTop: "var(--space-6)" }}>
        <p
          className={`type-micro-label t-11 ${fontMono.className}`}
          style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-3)" }}
        >
          ACCOUNT
        </p>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <p className="type-prose t-15">Signed in as {displayName}.</p>
          <button
            type="button"
            className="ui-button-link ui-focusable type-micro-label t-11"
            style={{ alignSelf: "flex-start" }}
            onClick={async () => {
              await fetch("/auth/signout", { method: "POST" });
              router.push("/login");
              router.refresh();
            }}
          >
            Sign out
          </button>
          {!confirmDelete ? (
            <button
              type="button"
              className="ui-button-link ui-focusable type-micro-label t-11"
              style={{ alignSelf: "flex-start", color: "var(--danger)" }}
              onClick={() => setConfirmDelete(true)}
            >
              Delete my account
            </button>
          ) : (
            <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: "var(--space-3)" }}>
              <p className="type-prose t-15" style={{ marginBottom: "var(--space-3)" }}>
                This permanently deletes your account, chart, readings, reflections, and
                connections. It cannot be undone. Export first if you want a copy.
              </p>
              <div style={{ display: "flex", gap: "var(--space-4)" }}>
                <button
                  type="button"
                  className="ui-button-link ui-focusable type-micro-label t-11"
                  style={{ color: "var(--danger)" }}
                  onClick={deleteAccount}
                >
                  Yes, delete everything
                </button>
                <button
                  type="button"
                  className="ui-button-link ui-focusable type-micro-label t-11"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {status && (
        <p
          className={`form-status type-micro-label t-11 ${fontMono.className}`}
          role="status"
        >
          {status.toUpperCase()}
        </p>
      )}
    </>
  );
}
