"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const COMMON_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function OnboardingPage() {
  const [birthDate, setBirthDate] = useState("");
  const [timeKnown, setTimeKnown] = useState<"yes" | "approx" | "no">("yes");
  const [birthTime, setBirthTime] = useState("");
  const [timeZone, setTimeZone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [placeLabel, setPlaceLabel] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(4));
      setLon(pos.coords.longitude.toFixed(4));
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/login");
      return;
    }

    const precision =
      timeKnown === "yes" ? "exact" : timeKnown === "approx" ? "approximate" : "unknown";

    const { error: upsertErr } = await supabase
      .from("birth_profiles")
      .upsert({
        user_id: userData.user.id,
        birth_date: birthDate,
        birth_time: precision === "unknown" ? null : birthTime || null,
        birth_time_precision: precision,
        birth_time_zone: timeZone,
        iana_timezone: timeZone,
        birth_lat: parseFloat(lat),
        birth_lon: parseFloat(lon),
        birth_place_label: placeLabel || null,
      });

    setBusy(false);
    if (upsertErr) {
      setError(upsertErr.message);
      return;
    }
    router.push("/day");
    router.refresh();
  }

  return (
    <main className="container">
      <h1 style={{ margin: "32px 0 8px" }}>Your birth details</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Precision matters: we store exactly how precise your time is and never
        pretend otherwise.
      </p>
      <form onSubmit={submit} className="card">
        <label htmlFor="bd">Birth date</label>
        <input
          id="bd"
          type="date"
          required
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />

        <label htmlFor="tk">Birth time</label>
        <select
          id="tk"
          value={timeKnown}
          onChange={(e) => setTimeKnown(e.target.value as never)}
        >
          <option value="yes">I know it exactly</option>
          <option value="approx">Approximate</option>
          <option value="no">I don&apos;t know it</option>
        </select>

        {timeKnown !== "no" && (
          <>
            <label htmlFor="bt">Time</label>
            <input
              id="bt"
              type="time"
              required
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
            />
          </>
        )}

        <label htmlFor="tz">Time zone at birth</label>
        <input
          id="tz"
          list="zones"
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value)}
          required
        />
        <datalist id="zones">
          {COMMON_ZONES.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>

        <label htmlFor="pl">Birth place (optional label)</label>
        <input
          id="pl"
          type="text"
          placeholder="e.g. New York, NY"
          value={placeLabel}
          onChange={(e) => setPlaceLabel(e.target.value)}
        />

        <label htmlFor="lat">Latitude</label>
        <input
          id="lat"
          type="number"
          step="any"
          min="-90"
          max="90"
          required
          value={lat}
          onChange={(e) => setLat(e.target.value)}
        />

        <label htmlFor="lon">Longitude</label>
        <input
          id="lon"
          type="number"
          step="any"
          min="-180"
          max="180"
          required
          value={lon}
          onChange={(e) => setLon(e.target.value)}
        />
        <button type="button" onClick={useMyLocation} style={{ marginTop: 8 }}>
          Use my current location
        </button>

        {error && (
          <p style={{ color: "#f28b82", marginTop: 12, fontSize: "0.9rem" }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
