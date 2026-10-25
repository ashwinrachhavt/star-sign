"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

/**
 * Consent actions (ASH-258): accept / decline for recipients; disconnect
 * / withdraw for requesters. Copy per copy.md — plain, no fear, no
 * pressure. Immediate effect on every action.
 */
export default function ConsentActions({
  connectionId,
  isRecipient,
  state,
}: {
  connectionId: string;
  isRecipient: boolean;
  state: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function call(method: "PUT" | "DELETE", path = "") {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/connections/${connectionId}${path}`, { method });
    setBusy(false);
    if (!res.ok && res.status !== 204) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Something went wrong.");
      return;
    }
    router.refresh();
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
