import { createClient } from "@/lib/supabase/server";
import { computeWeekAhead } from "@star-sign/core";
import { redirect } from "next/navigation";
import { ScreenHeader, TransitEventCard } from "@/components/ui";
import { fontMono } from "@/app/fonts";

const PLANET_GLYPHS: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
};

const ASPECT_WORDS: Record<string, string> = {
  conjunction: "meets",
  opposition: "opposes",
  square: "squares",
  trine: "trines",
  sextile: "sextiles",
};

export default async function WeekPage() {
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

  const { data: fullProfile } = await supabase
    .from("birth_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  const week = computeWeekAhead({
    birthDate: fullProfile.birth_date,
    birthTime: fullProfile.birth_time ?? undefined,
    birthTimePrecision: fullProfile.birth_time_precision,
    birthTimeZone: fullProfile.birth_time_zone,
    birthPlace: {
      lat: fullProfile.birth_lat,
      lon: fullProfile.birth_lon,
    },
  });

  return (
    <main className="container">
      <ScreenHeader
        title="Your Week"
        tabs={[
          { id: "day", label: "My Day", href: "/day" },
          { id: "week", label: "Week", href: "/week" },
          { id: "people", label: "People", href: "/people" },
        ]}
        activeTab="week"
      />

      {week.quiet ? (
        <p
          className="type-prose t-17"
          style={{ color: "var(--ink-secondary)", marginTop: "var(--space-6)" }}
        >
          A quiet week — the sky has nothing loud planned. Rest or start
          something of your own.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
            marginTop: "var(--space-5)",
          }}
        >
          {week.days.map((day) => {
            if (day.events.length === 0) return null;
            const dateLabel = new Date(day.date + "T12:00:00").toLocaleDateString(
              "en-US",
              { weekday: "long", month: "long", day: "numeric" },
            );
            return (
              <section key={day.date}>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {day.events.map((e) => (
                    <TransitEventCard
                      key={`${day.date}-${e.transit}-${e.type}-${e.natal}`}
                      dateRange={dateLabel.toUpperCase()}
                      title={`${PLANET_GLYPHS[e.transit]} ${e.transit.charAt(0).toUpperCase() + e.transit.slice(1)} ${ASPECT_WORDS[e.type]} natal ${e.natal.charAt(0).toUpperCase() + e.natal.slice(1)}`}
                    >
                      {e.retrograde ? "Retrograde. " : ""}
                      Orb {e.orb.toFixed(1)}° · touches{" "}
                      {e.areas.join(", ")}
                    </TransitEventCard>
                  ))}                </div>
              </section>
            );
          })}
        </div>
      )}

      <section style={{ marginTop: "var(--space-6)" }}>
        <ProvenanceFooter version={week.version} />
      </section>
    </main>
  );
}

function ProvenanceFooter({ version }: { version: string }) {
  return (
    <p
      className={`type-micro-label t-11 ${fontMono.className}`}
      style={{ color: "var(--ink-tertiary)" }}
    >
      WEEK-AHEAD RULESET {version} · EVENTS COMPUTED FROM YOUR CHART
    </p>
  );
}
