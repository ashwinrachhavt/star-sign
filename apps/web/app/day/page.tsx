import { createClient } from "@/lib/supabase/server";
import { getOrCreateDailyReading } from "@/lib/readings";
import { computeNatalChart, type DailyReading } from "@star-sign/core";
import { redirect } from "next/navigation";
import SignOutButton from "./signout-button";
import {
  DosDonts,
  Glance,
  LifeAreaRow,
  ProvenanceBlock,
  ScreenHeader,
} from "@/components/ui";
import { fontMono } from "@/app/fonts";

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

  const dateLine = new Date(forDate + "T12:00:00").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "long", day: "numeric" },
  );

  return (
    <main className="container">
      <ScreenHeader
        title="My Day"
        tabs={[
          { id: "day", label: "My Day", href: "/day" },
          { id: "people", label: "People", href: "/people" },
        ]}
        activeTab="day"
      />

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: "var(--space-2)",
        }}
      >
        <SignOutButton />
      </div>

      <section style={{ marginTop: "var(--space-4)" }}>
        <p
          className={`type-micro-label t-11 ${fontMono.className}`}
          style={{ color: "var(--ink-tertiary)" }}
        >
          {dateLine}
        </p>
        <div style={{ marginTop: "var(--space-4)" }}>
          <Glance headline={reading.headline}>{reading.explanation}</Glance>
        </div>
      </section>

      <section className="card" style={{ marginTop: "var(--space-5)" }}>
        <DosDonts dos={reading.dos} donts={reading.donts} doLabel="Dos" dontLabel="Don'ts" />
      </section>

      <section className="card" style={{ marginTop: "var(--space-4)" }}>
        <p
          className={`type-micro-label t-11 ${fontMono.className}`}
          style={{ color: "var(--ink-tertiary)", marginBottom: "var(--space-2)" }}
        >
          Life areas today
        </p>
        {reading.lifeAreas.map((area) => (
          <LifeAreaRow key={area} area={AREA_LABELS[area] ?? area} state="—" />
        ))}
      </section>

      <section style={{ marginTop: "var(--space-5)" }}>
        <ProvenanceBlock summary="Why this reading?">
          <p className="type-prose t-15" style={{ color: "var(--ink)" }}>
            Sun in {sun.sign}, Moon in {moon.sign}
            {chart.ascendant ? `, Ascendant ${chart.ascendant}` : ""}.
          </p>
          <p>
            Ruleset {reading.provenance.rulesetVersion} · copy{" "}
            {reading.provenance.copyVersion} ·{" "}
            {reading.provenance.inputs.length} astronomical inputs
          </p>
          <p>{reading.uncertaintyNote}</p>
        </ProvenanceBlock>
      </section>
    </main>
  );
}
