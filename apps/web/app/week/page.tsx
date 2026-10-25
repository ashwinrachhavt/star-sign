import { createClient } from "@/lib/supabase/server";
import { computeWeekAhead } from "@star-sign/core";
import { redirect } from "next/navigation";
import { ScreenHeader, TransitEventCard } from "@/components/ui";
import { dateRangeLabel } from "@/components/ui/glyphs";
import { fontMono } from "@/app/fonts";

/** Structural mirror of core's TransitEvent (ruleset.ts not re-exported). */
interface WeekEvent {
  transit: string;
  natal: string;
  type: string;
  orb: number;
  retrograde: boolean;
  areas: readonly string[];
  score: number;
}

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

const AREA_LABELS: Record<string, string> = {
  love: "love", work: "work", money: "money", home: "home",
  family: "family", friends: "friends", self: "self",
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Prose strictly derived from the event's data (ASH-254 AC3) — no invented
 * explanation. Every clause traces to a field of the TransitEvent.
 */
function eventProse(e: WeekEvent): string {
  const parts: string[] = [];
  if (e.retrograde) parts.push("Retrograde.");
  parts.push(`Orb ${e.orb.toFixed(1)}°.`);
  const areas = e.areas.map((a) => AREA_LABELS[a] ?? a);
  if (areas.length > 0) parts.push(`Touches ${areas.join(", ")}.`);
  return parts.join(" ");
}

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
          {week.days.map((day, i) => {
            if (day.events.length === 0) return null;
            return (
              <section key={day.date}>
                {i > 0 && (
                  <hr
                    style={{
                      border: "none",
                      borderTop: "1px solid var(--hairline)",
                      marginBottom: "var(--space-5)",
                    }}
                  />
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                  {day.events.map((e) => (
                    <TransitEventCard
                      key={`${day.date}-${e.transit}-${e.type}-${e.natal}`}
                      dateRange={dateRangeLabel(day.date)}
                      transit={e.transit}
                      aspect={e.type}
                      natal={e.natal}
                      title={`${cap(e.transit)} ${ASPECT_WORDS[e.type]} natal ${cap(e.natal)}`}
                      footer={
                        <span>
                          {PLANET_GLYPHS[e.transit]} {cap(e.transit)} · score{" "}
                          {e.score.toFixed(1)}
                        </span>
                      }
                    >
                      {eventProse(e)}
                    </TransitEventCard>
                  ))}
                </div>
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
