"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

const RELATIONS = ["partner", "crush", "friend", "family"] as const;

export default function AddPersonForm() {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [relation, setRelation] = useState<string>("friend");
  const [birthDate, setBirthDate] = useState("");
  const [timeKnown, setTimeKnown] = useState<"yes" | "approx" | "no">("no");
  const [birthTime, setBirthTime] = useState("");
  const [timeZone, setTimeZone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const precision =
      timeKnown === "yes" ? "exact" : timeKnown === "approx" ? "approximate" : "unknown";
    const { error: err } = await supabase.from("people").insert({
      display_name: displayName,
      relation,
      birth_date: birthDate || null,
      birth_time: precision === "unknown" ? null : birthTime || null,
      birth_time_precision: precision,
      birth_time_zone: birthDate ? timeZone : null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDisplayName("");
    setBirthDate("");
    setBirthTime("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="link" onClick={() => setOpen(true)}>
        Add someone
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="card">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <Input
          id="pn"
          label="Name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />

        <div className="ui-input-field">
          <label htmlFor="rel" className="ui-input-label type-micro-label t-11">
            Relationship
          </label>
          <select
            id="rel"
            className="ui-input ui-focusable type-prose t-15"
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            style={{ paddingTop: "var(--space-2)" }}
          >
            {RELATIONS.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <Input
          id="pbd"
          label="Birth date (optional)"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />

        {birthDate && (
          <>
            <div className="ui-input-field">
              <label htmlFor="ptk" className="ui-input-label type-micro-label t-11">
                Birth time precision
              </label>
              <select
                id="ptk"
                className="ui-input ui-focusable type-prose t-15"
                value={timeKnown}
                onChange={(e) => setTimeKnown(e.target.value as never)}
                style={{ paddingTop: "var(--space-2)" }}
              >
                <option value="yes">Exact</option>
                <option value="approx">Approximate</option>
                <option value="no">Unknown</option>
              </select>
            </div>
            {timeKnown !== "no" && (
              <Input
                id="pt"
                label="Time"
                type="time"
                aria-label="Birth time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
              />
            )}
          </>
        )}

        {error && <p className="form-error type-prose t-15">{error}</p>}

        <div style={{ display: "flex", gap: "var(--space-5)" }}>
          <Button type="submit" variant="solid" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
          <Button variant="link" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}
