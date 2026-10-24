"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import { fontSerif } from "@/app/fonts";

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

const PRECISION_OPTIONS = [
  { value: "yes", label: "I know it exactly" },
  { value: "approx", label: "Approximate — close enough" },
  { value: "no", label: "I don't know it" },
] as const;

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingForm />
    </Suspense>
  );
}

function OnboardingForm() {
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
  const searchParams = useSearchParams();
  const isEdit = searchParams.get("edit") === "1";
  const supabase = createClient();

  // Edit mode (ASH-248 criterion 4): pre-fill from the stored profile.
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data: row } = await supabase
        .from("birth_profiles")
        .select("*")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!row) return;
      setBirthDate(row.birth_date ?? "");
      setTimeKnown(
        row.birth_time_precision === "exact"
          ? "yes"
          : row.birth_time_precision === "approximate"
            ? "approx"
            : "no",
      );
      setBirthTime(row.birth_time ?? "");
      setTimeZone(row.iana_timezone ?? row.birth_time_zone ?? "");
      setPlaceLabel(row.birth_place_label ?? "");
      setLat(row.birth_lat != null ? String(row.birth_lat) : "");
      setLon(row.birth_lon != null ? String(row.birth_lon) : "");
    })();
  }, [isEdit, supabase]);

  const precisionChip =
    timeKnown === "yes" ? "Exact" : timeKnown === "approx" ? "Approximate" : "Unknown";

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
    // First-run goes through chart verification (ASH-248); edits return
    // to the verification screen for a re-check.
    router.push("/verify");
    router.refresh();
  }

  return (
    <main className="container">
      <h1
        className={`type-display t-28 ${fontSerif.className}`}
        style={{ margin: "var(--space-6) 0 var(--space-2)" }}
      >
        Your birth details
      </h1>
      <p
        className="type-prose t-15"
        style={{ color: "var(--ink-secondary)", marginBottom: "var(--space-5)" }}
      >
        Precision matters: we store exactly how precise your time is and never
        pretend otherwise.
      </p>
      <form onSubmit={submit} className="card">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <Input
            id="bd"
            label="Birth date"
            type="date"
            required
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />

          <div className="ui-input-field">
            <span
              id="tk-label"
              className="ui-input-label type-micro-label t-11"
            >
              Birth time
            </span>
            <div
              role="radiogroup"
              aria-labelledby="tk-label"
              style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
            >
              {PRECISION_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="ui-focusable type-prose t-15"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    minHeight: "44px",
                    cursor: "pointer",
                    color:
                      timeKnown === opt.value
                        ? "var(--ink)"
                        : "var(--ink-secondary)",
                  }}
                >
                  <input
                    type="radio"
                    name="timeKnown"
                    value={opt.value}
                    checked={timeKnown === opt.value}
                    onChange={() => setTimeKnown(opt.value)}
                    style={{ accentColor: "var(--ink)" }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {timeKnown !== "no" && (
            <Input
              id="bt"
              label="Time"
              chip={precisionChip}
              type="time"
              required
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
            />
          )}

          <Input
            id="tz"
            label="Time zone at birth"
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

          <Input
            id="pl"
            label="Birth place (optional label)"
            type="text"
            placeholder="e.g. New York, NY"
            value={placeLabel}
            onChange={(e) => setPlaceLabel(e.target.value)}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-4)",
            }}
          >
            <Input
              id="lat"
              label="Latitude"
              type="number"
              step="any"
              min="-90"
              max="90"
              required
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
            <Input
              id="lon"
              label="Longitude"
              type="number"
              step="any"
              min="-180"
              max="180"
              required
              value={lon}
              onChange={(e) => setLon(e.target.value)}
            />
          </div>

          <button
            type="button"
            onClick={useMyLocation}
            className="ui-button-link ui-focusable type-micro-label t-13"
            style={{ width: "fit-content" }}
          >
            Use my current location
          </button>

          {error && <p className="form-error type-prose t-15">{error}</p>}

          <div>
            <Button type="submit" variant="solid" disabled={busy}>
              {busy ? "Saving…" : "Continue"}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}
