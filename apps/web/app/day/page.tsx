import { createClient } from "@/lib/supabase/server";
import { getOrCreateDailyReading } from "@/lib/readings";
import { computeNatalChart, type DailyReading } from "@star-sign/core";
import { redirect } from "next/navigation";
import SignOutButton from "./signout-button";

function todayFor(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
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

export default async function DayPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const userId = userData.user.id;

  const { data: profileRow } = await supabase
    .from("birth_profiles")
    .select("birth_time_zone")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profileRow) redirect("/onboarding");

  const forDate = todayFor(profileRow.birth_time_zone);
  const result = await getOrCreateDailyReading(supabase, userId, forDate);

  if ("error" in result) redirect("/onboarding");
  const reading = result as DailyReading;

  const { data: fullProfile } = await supabase
    .from("birth_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  const chart = computeNatalChart({
    birthDate: fullProfile.birth_date,
    birthTime: fullProfile.birth_time ?? undefined,
    birthTimePrecision: fullProfile.birth_time_precision,
    birthTimeZone: fullProfile.birth_time_zone,
    birthPlace: {
      lat: fullProfile.birth_lat,
      lon: fullProfile.birth_lon,
    },
  });

  const sun = chart.placements.find((p) => p.planet === "sun")!;
  const moon = chart.placements.find((p) => p.planet === "moon")!;

  return (
    <main className="container">
      <nav className="top">
        <a href="/day">My Day</a>
        <a href="/people">People</a>
        <span style={{ flex: 1 }} />
        <SignOutButton />
      </nav>

      <p className="muted" style={{ marginTop: 16 }}>
        {new Date(forDate + "T12:00:00").toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      </p>
      <h1 className="headline" style={{ marginTop: 8 }}>
        {reading.headline}
      </h1>
      <p style={{ lineHeight: 1.6 }}>{reading.explanation}</p>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="dos-donts">
          <div>
            <p className="muted" style={{ marginBottom: 6 }}>
              Dos
            </p>
            <ul>
              {reading.dos.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="muted" style={{ marginBottom: 6 }}>
              Don&apos;ts
            </p>
            <ul>
              {reading.donts.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div>
        {reading.lifeAreas.map((area) => (
          <span key={area} className="badge">
            {AREA_LABELS[area] ?? area}
          </span>
        ))}
      </div>

      <details className="card" style={{ marginTop: 20 }}>
        <summary>Why this reading? (chart &amp; provenance)</summary>
        <p style={{ marginTop: 12, fontSize: "0.9rem" }}>
          Sun in {sun.sign}, Moon in {moon.sign}
          {chart.ascendant ? `, Ascendant ${chart.ascendant}` : ""}.
        </p>
        <p style={{ marginTop: 8, fontSize: "0.85rem" }} className="muted">
          Ruleset {reading.provenance.rulesetVersion} · copy{" "}
          {reading.provenance.copyVersion} ·{" "}
          {reading.provenance.inputs.length} astronomical inputs
        </p>
        <p style={{ marginTop: 8, fontSize: "0.85rem", color: "#f5c98a" }}>
          {reading.uncertaintyNote}
        </p>
      </details>
    </main>
  );
}
