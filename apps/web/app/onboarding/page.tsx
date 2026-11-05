"use client";

export const dynamic = "force-dynamic";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import { PlacePicker } from "@/components/PlacePicker";
import {
  applyPick,
  dedupeCandidates,
  geocodeFailureMessage,
  shouldFetchPlaceQuery,
  type GeocodeFailure,
  type PlaceCandidate,
  type PickedPlace,
} from "@/lib/places";
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
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [candidates, setCandidates] = useState<PlaceCandidate[]>([]);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
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
  }, [isEdit, supabase]);

  const precisionChip =
    timeKnown === "yes" ? "Exact" : timeKnown === "approx" ? "Approximate" : "Unknown";

  // Geocode on place edits (debounced): the user types a place name and
  // picks a candidate — the server resolves its coordinates (owner
  // request, 2026-10-25). Every failure surfaces in the form: the API
  // distinguishes no-match (404) from provider-down (502) and rate
  // limiting (429), and the client renders the message — never a silent
  // empty state.
  useEffect(() => {
    const query = placeLabel.trim();
    // All setState happens inside the debounced timer: calling it
    // synchronously in the effect body triggers cascading renders
    // (react-hooks setState-in-effect rule).
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!shouldFetchPlaceQuery(query, place ? place.resolvedName : null)) {
        setCandidates([]);
        return;
      }
      setPlaceBusy(true);
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          signal: controller.signal,
        });
        if (res.ok) {
          const body = await res.json();
          setCandidates(dedupeCandidates(body.data.candidates));
          setPlaceError(null);
        } else {
          const body = await res.json().catch(() => null);
          const code = body?.error?.code;
          const failure: GeocodeFailure =
            code === "not_found" ||
            code === "upstream_unavailable" ||
            code === "rate_limited"
              ? code
              : "unknown";
          setCandidates([]);
          // Prefer the route's copy; the local mapping is the fallback
          // for an unreadable envelope.
          setPlaceError(body?.error?.message ?? geocodeFailureMessage(failure, query));
        }
      } catch (e) {
        // A newer query aborted this one (cleanup owns the UI now) — not
        // an error to swallow, a cancellation to honor.
        if (e instanceof DOMException && e.name === "AbortError") return;
        setCandidates([]);
        setPlaceError(geocodeFailureMessage("network", query));
      } finally {
        setPlaceBusy(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [placeLabel, place]);

  // Typing releases the lock: the coordinates persist only while the
  // picked candidate's title is what's in the box.
  function handlePlaceQuery(query: string) {
    setPlaceLabel(query);
    setPlaceError(null);
    if (place && query.trim().toLowerCase() !== place.resolvedName.trim().toLowerCase()) {
      setPlace(null);
    }
  }

  // An explicit pick: lock coordinates, adopt the provider's IANA zone
  // suggestion when it has one.
  function handlePlacePick(candidate: PlaceCandidate) {
    const { place: locked, timeZone: adopted } = applyPick(candidate, timeZone);
    setPlace(locked);
    setPlaceLabel(locked.resolvedName);
    setPlaceError(null);
    setCandidates([]);
    if (adopted) setTimeZone(adopted);
  }

  // Onboarding tracking (owner request): record who is onboarding and
  // everything entered, updated as the flow progresses.
  async function trackOnboarding(
    userData: { id: string; email?: string },
    completed: boolean,
  ) {
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

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/login");
      return;
    }

    if (!place) {
      setBusy(false);
      setError("Pick a birth place from the list. We resolve the coordinates for you.");
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
        birth_lat: place.lat,
        birth_lon: place.lon,
        birth_place_label: placeLabel || null,
      });

    if (upsertErr) {
      setBusy(false);
      setError(upsertErr.message);
      return;
    }

    // Completed onboarding record.
    await trackOnboarding({ id: userData.user.id, email: userData.user.email }, true);

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

          <PlacePicker
            query={placeLabel}
            onQueryChange={handlePlaceQuery}
            candidates={candidates}
            loading={placeBusy}
            error={placeError}
            picked={place}
            onPick={handlePlacePick}
            required
          />

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
