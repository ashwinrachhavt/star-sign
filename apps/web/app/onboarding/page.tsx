"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button, Input } from "@/components/ui";
import { fontMono, fontSerif } from "@/app/fonts";

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
  { value: "approx", label: "Approximate, close enough" },
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
  const [place, setPlace] = useState<{
    lat: number;
    lon: number;
    resolvedName: string;
    country: string | null;
    timezone: string | null;
  } | null>(null);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeNotFound, setPlaceNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = searchParams.get("edit") === "1";

  // Edit mode (ASH-248 criterion 4): pre-fill from the stored profile.
  // Server route resolves the actor (Clerk or Supabase session), so this
  // page needs no auth client of its own.
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const res = await fetch("/api/me/birth-profile");
      if (!res.ok) return;
      const body = await res.json().catch(() => null);
      const row = body?.data as
        | {
            birth_date?: string | null;
            birth_time?: string | null;
            birth_time_precision?: string | null;
            birth_time_zone?: string | null;
            iana_timezone?: string | null;
            birth_place_label?: string | null;
            birth_lat?: number | null;
            birth_lon?: number | null;
          }
        | null
        | undefined;
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
      if (row.birth_lat != null && row.birth_lon != null) {
        setPlace({
          lat: row.birth_lat,
          lon: row.birth_lon,
          resolvedName: row.birth_place_label ?? "",
          country: null,
          timezone: null,
        });
      }
    })();
  }, [isEdit]);

  const precisionChip =
    timeKnown === "yes" ? "Exact" : timeKnown === "approx" ? "Approximate" : "Unknown";

  // Geocode on place edits (debounced): the user types a place name and
  // the server resolves coordinates — no manual lat/lon entry (owner
  // request, 2026-10-25).
  useEffect(() => {
    const query = placeLabel.trim();
    // All setState happens inside the debounced timer: calling it
    // synchronously in the effect body triggers cascading renders
    // (react-hooks setState-in-effect rule).
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setPlace(null);
        setPlaceNotFound(false);
        return;
      }
      setPlaceBusy(true);
      setPlaceNotFound(false);
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        if (res.status === 401) {
          // Signed out or the request carried no session. Without this
          // the field reports "No match" for a perfectly valid city and
          // the user is stuck with no way to recover.
          router.replace("/login");
          return;
        }
        if (res.ok) {
          const body = await res.json();
          setPlace({
            lat: body.data.lat,
            lon: body.data.lon,
            resolvedName: body.data.resolvedName ?? query,
            country: body.data.country ?? null,
            timezone: body.data.timezone ?? null,
          });
          // Adopt the provider's IANA zone suggestion when we have one.
          if (body.data.timezone) setTimeZone(body.data.timezone);
        } else {
          setPlace(null);
          setPlaceNotFound(true);
        }
      } catch {
        setPlace(null);
        setPlaceNotFound(true);
      } finally {
        setPlaceBusy(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [placeLabel, router]);

  // Onboarding tracking (owner request): record who is onboarding and
  // everything entered, updated as the flow progresses.
  async function trackOnboarding(completed: boolean) {
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birthDate: birthDate || null,
          birthTime: timeKnown === "no" ? null : birthTime || null,
          birthTimePrecision:
            timeKnown === "yes" ? "exact" : timeKnown === "approx" ? "approximate" : "unknown",
          birthTimeZone: timeZone,
          birthPlaceLabel: placeLabel || null,
          birthLat: place?.lat ?? null,
          birthLon: place?.lon ?? null,
          completed,
        }),
      });
    } catch {
      // Tracking is observability — never block the flow on it.
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (!place) {
      setBusy(false);
      setError("Wait for your birth place to resolve, then continue.");
      return;
    }

    const precision =
      timeKnown === "yes" ? "exact" : timeKnown === "approx" ? "approximate" : "unknown";

    // Save through the server route so the actor is resolved by the auth
    // bridge (Clerk or Supabase session) — the browser Supabase client
    // carries no Clerk token.
    const res = await fetch("/api/me/birth-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        birthDate,
        birthTime: precision === "unknown" ? null : birthTime || null,
        birthTimePrecision: precision,
        birthTimeZone: timeZone,
        ianaTimeZone: timeZone,
        birthPlace: {
          lat: place.lat,
          lon: place.lon,
          label: placeLabel || null,
        },
      }),
    });

    if (res.status === 401) {
      setBusy(false);
      router.push("/login");
      return;
    }

    if (!res.ok) {
      setBusy(false);
      setError("Could not save your birth details. Try again.");
      return;
    }

    // Completed onboarding record.
    await trackOnboarding(true);

    setBusy(false);
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
            label="Birth place"
            type="text"
            placeholder="e.g. Pune, India"
            value={placeLabel}
            onChange={(e) => setPlaceLabel(e.target.value)}
            required
            autoComplete="off"
          />
          {placeBusy && (
            <p
              className={`type-mono t-11 ${fontMono.className}`}
              style={{ color: "var(--ink-tertiary)", margin: "calc(-1 * var(--space-3)) 0 0" }}
            >
              Resolving…
            </p>
          )}
          {!placeBusy && place && (
            <p
              className={`type-mono t-11 ${fontMono.className}`}
              style={{ color: "var(--ink-tertiary)", margin: "calc(-1 * var(--space-3)) 0 0" }}
            >
              ✓ {place.resolvedName}
              {place.country ? `, ${place.country}` : ""} ({place.lat.toFixed(2)}°,{" "}
              {place.lon.toFixed(2)}°)
              {place.timezone ? ` · ${place.timezone}` : ""}
            </p>
          )}
          {!placeBusy && !place && placeNotFound && (
            <p
              className={`type-mono t-11 ${fontMono.className}`}
              style={{
                color: "var(--ink-secondary)",
                margin: "calc(-1 * var(--space-3)) 0 0",
              }}
            >
              No match — try a city name, e.g. &ldquo;Pune, India&rdquo;.
            </p>
          )}

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
