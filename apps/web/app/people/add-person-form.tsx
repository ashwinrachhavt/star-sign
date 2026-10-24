"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AddPersonForm() {
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [relation, setRelation] = useState("friend");
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
      <button onClick={() => setOpen(true)} style={{ width: "auto", padding: "10px 20px" }}>
        + Add someone
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card">
      <label htmlFor="pn">Name</label>
      <input
        id="pn"
        required
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
      />

      <label htmlFor="rel">Relationship</label>
      <select
        id="rel"
        value={relation}
        onChange={(e) => setRelation(e.target.value)}
      >
        <option value="partner">Partner</option>
        <option value="crush">Crush</option>
        <option value="friend">Friend</option>
        <option value="family">Family</option>
      </select>

      <label htmlFor="pbd">Birth date (optional)</label>
      <input
        id="pbd"
        type="date"
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
      />

      {birthDate && (
        <>
          <label htmlFor="ptk">Birth time</label>
          <select
            id="ptk"
            value={timeKnown}
            onChange={(e) => setTimeKnown(e.target.value as never)}
          >
            <option value="yes">Exact</option>
            <option value="approx">Approximate</option>
            <option value="no">Unknown</option>
          </select>
          {timeKnown !== "no" && (
            <input
              type="time"
              aria-label="Birth time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
              style={{ marginTop: 8 }}
            />
          )}
        </>
      )}

      {error && (
        <p style={{ color: "#f28b82", marginTop: 12, fontSize: "0.9rem" }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
