"use client";

import { useEffect, useState } from "react";
import { LifeAreaRow } from "@/components/ui";
import { fontMono } from "@/app/fonts";

/**
 * Friend updates (W2, SHAPE F): one card per accepted, granted
 * connection — that person's daily theme, straight from
 * GET /api/friend-updates. Derived per read; toggling a grant or
 * revoking a connection removes the card on the next fetch.
 */
interface FriendUpdate {
  connectionId: string;
  displayName: string;
  handle: string | null;
  headline: string;
  lifeAreas: Array<{ area: string; state: string }>;
  basis: { precision: string };
  uncertaintyNote: string | null;
}

const AREA_LABELS: Record<string, string> = {
  love: "Love",
  work: "Work",
  money: "Money",
  home: "Home & family",
  family: "Family",
  friends: "Friends",
  self: "Self",
};

export default function FriendUpdatesSection() {
  const [updates, setUpdates] = useState<FriendUpdate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/friend-updates")
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
      .then((body) => {
        if (alive) setUpdates(body?.data?.updates ?? []);
      })
      .catch(() => {
        if (alive) setError("Couldn't load friend updates.");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return (
      <section style={{ marginTop: "var(--space-5)" }}>
        <p className="type-prose t-15" style={{ color: "var(--ink-tertiary)" }}>
          {error}
        </p>
      </section>
    );
  }
  if (updates === null) return null; // loading: the section appears quietly
  if (updates.length === 0) return null; // nothing granted yet: no empty-state noise

  return (
    <section style={{ marginTop: "var(--space-5)" }}>
      <p
        className={`type-micro-label t-11 ${fontMono.className}`}
        style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-2)" }}
      >
        FRIEND UPDATES
      </p>
      <p
        className="type-prose t-15"
        style={{ color: "var(--ink-secondary)", marginBottom: "var(--space-4)" }}
      >
        Today&apos;s theme for the people who share their daily updates with
        you: the theme only, never their birth details.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {updates.map((u) => (
          <article key={u.connectionId} className="ui-card" style={{ padding: "var(--space-4)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--space-4)" }}>
              <span className="type-prose t-15">{u.displayName}</span>
              {u.handle && (
                <span
                  className={`type-micro-label t-11 ${fontMono.className}`}
                  style={{ color: "var(--ink-tertiary)" }}
                >
                  @{u.handle}
                </span>
              )}
            </div>
            <p className="type-display t-22" style={{ margin: "var(--space-3) 0 var(--space-2)" }}>
              {u.headline}
            </p>
            {u.lifeAreas.map((a) => (
              <LifeAreaRow key={a.area} area={AREA_LABELS[a.area] ?? a.area} state={a.state} />
            ))}
            {u.basis.precision !== "exact" && u.uncertaintyNote && (
              <p
                className={`type-micro-label t-11 ${fontMono.className}`}
                style={{ color: "var(--ink-tertiary)", marginTop: "var(--space-3)" }}
              >
                {u.uncertaintyNote.toUpperCase()}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
