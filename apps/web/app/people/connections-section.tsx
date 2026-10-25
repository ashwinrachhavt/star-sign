"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { fontMono } from "@/app/fonts";
import { z } from "zod";

export interface ConnectionView {
  id: string;
  state: "requested" | "accepted" | "revoked" | "disconnected";
  outgoing: boolean;
  otherName: string;
  otherId: string;
}

/**
 * Connections hub (ASH-258 / 5.3): pending incoming/outgoing, connected
 * partners, connect-by-code. FriendRow grammar per ref 11.png; consent
 * copy per copy.md rule 5 — plain, never dark-pattern.
 */
export default function ConnectionsSection({
  connections,
  viewerId,
}: {
  connections: ConnectionView[];
  viewerId: string;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const incoming = connections.filter((c) => c.state === "requested" && !c.outgoing);
  const outgoing = connections.filter((c) => c.state === "requested" && c.outgoing);
  const accepted = connections.filter((c) => c.state === "accepted");
  const ended = connections.filter(
    (c) => c.state === "revoked" || c.state === "disconnected",
  );

  async function act(
    id: string,
    method: "PUT" | "DELETE",
    path = "",
    successNote?: string,
  ) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/connections/${id}${path}`, { method });
    setBusy(false);
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Something went wrong.");
      return;
    }
    if (successNote) setNotice(successNote);
    router.refresh();
  }

  async function requestByCode(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().uuid().safeParse(code.trim());
    if (!parsed.success) {
      setError("That doesn't look like a connection code.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addresseeId: parsed.data }),
    });
    setBusy(false);
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error?.message ?? "Could not send the request.");
      return;
    }
    setCode("");
    setNotice("Request sent. They'll see it next time they open People.");
    router.refresh();
  }

  return (
    <section style={{ marginTop: "var(--space-5)" }}>
      <p
        className={`type-micro-label t-11 ${fontMono.className}`}
        style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-2)" }}
      >
        CONNECTIONS
      </p>
      <p
        className="type-prose t-15"
        style={{ color: "var(--ink-secondary)", marginBottom: "var(--space-4)" }}
      >
        A connection lets you both see each other's chart — nothing more.
        Only your connected person sees your chart, and either of you can
        end it at any time.
      </p>

      {/* Connect by code */}
      <form onSubmit={requestByCode} className="card">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <label
            htmlFor="connection-code"
            className="type-micro-label t-11"
            style={{ color: "var(--ink-secondary)" }}
          >
            Connect with someone
          </label>
          <input
            id="connection-code"
            className="ui-input type-prose t-15"
            placeholder="Paste their connection code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{
              background: "none",
              border: "none",
              borderBottom: "1px solid var(--hairline)",
              color: "var(--ink)",
              padding: "var(--space-3) 0",
            }}
          />
          <p className="type-micro-label t-11" style={{ color: "var(--ink-tertiary)" }}>
            THEIR CODE IS THE ID ON THEIR PEOPLE PAGE — SHARE IT ONLY WITH
            SOMEONE YOU TRUST.
          </p>
          {error && <p className="form-error type-prose t-15">{error}</p>}
          {notice && <p className="form-status type-prose t-15">{notice}</p>}
          <div>
            <Button type="submit" variant="solid" disabled={busy}>
              Send request
            </Button>
          </div>
        </div>
      </form>

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <div style={{ marginTop: "var(--space-5)" }}>
          <p className="type-micro-label t-11" style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-2)" }}>
            THEY WANT TO CONNECT
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {incoming.map((c) => (
              <div key={c.id} className="card" style={{ marginBottom: 0 }}>
                <p className="type-prose t-15">{c.otherName}</p>
                <p className="type-micro-label t-11" style={{ color: "var(--ink-secondary)", marginTop: "var(--space-1)" }}>
                  WANTS TO SEE YOUR CHART — AND SHARE THEIRS
                </p>
                <div style={{ display: "flex", gap: "var(--space-5)", marginTop: "var(--space-3)" }}>
                  <Button variant="link" href={`/connections/${c.id}`} onClick={undefined}>
                    Review &amp; decide
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing pending */}
      {outgoing.length > 0 && (
        <div style={{ marginTop: "var(--space-5)" }}>
          <p className="type-micro-label t-11" style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-2)" }}>
            WAITING FOR THEIR YES
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {outgoing.map((c) => (
              <div key={c.id} className="ui-card ui-friend-row" style={{ padding: "var(--space-4)" }}>
                <span>
                  <span className="type-prose t-15" style={{ display: "block" }}>
                    {c.otherName}
                  </span>
                  <span className={`type-micro-label t-11 ${fontMono.className}`} style={{ color: "var(--ink-secondary)" }}>
                    REQUEST SENT — THEY HAVEN&apos;T ANSWERED YET
                  </span>
                </span>
                <button
                  className="ui-button-link ui-focusable type-micro-label t-11"
                  disabled={busy}
                  onClick={() => act(c.id, "DELETE", "", "Request withdrawn.")}
                  style={{ color: "var(--ink-secondary)" }}
                >
                  Withdraw
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connected */}
      {accepted.length > 0 ? (
        <div style={{ marginTop: "var(--space-5)" }}>
          <p className="type-micro-label t-11" style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-2)" }}>
            CONNECTED
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {accepted.map((c) => (
              <div key={c.id} className="ui-card ui-friend-row" style={{ padding: "var(--space-4)" }}>
                <span>
                  <span className="type-prose t-15" style={{ display: "block" }}>
                    {c.otherName}
                  </span>
                  <span className={`type-micro-label t-11 ${fontMono.className}`} style={{ color: "var(--ink-secondary)" }}>
                    ☉ CHART SHARED BOTH WAYS
                  </span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                  <a
                    href={`/connections/${c.id}/chart`}
                    className="ui-button-link ui-focusable type-micro-label t-11"
                  >
                    View chart ›
                  </a>
                  <button
                    className="ui-button-link ui-focusable type-micro-label t-11"
                    disabled={busy}
                    onClick={() => act(c.id, "DELETE", "", "Connection ended. They can no longer see your chart.")}
                    style={{ color: "var(--ink-secondary)" }}
                  >
                    Disconnect
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        incoming.length === 0 &&
        outgoing.length === 0 && (
          <p
            className="type-prose t-15"
            style={{ color: "var(--ink-secondary)", marginTop: "var(--space-5)" }}
          >
            No connections yet. When someone accepts, their chart appears here.
          </p>
        )
      )}

      {/* Ended history — honest, compact, no re-request pushing */}
      {ended.length > 0 && (
        <details style={{ marginTop: "var(--space-5)" }}>
          <summary className="ui-focusable type-micro-label t-11" style={{ color: "var(--ink-tertiary)" }}>
            Ended connections ({ended.length})
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
            {ended.map((c) => (
              <p key={c.id} className="type-prose t-15" style={{ color: "var(--ink-tertiary)" }}>
                {c.otherName} — {c.state === "revoked" ? "declined or withdrawn" : "disconnected"}
              </p>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
