import { createClient } from "@/lib/supabase/server";
import {
  computeNatalChart,
  generateCompatibilityReport,
  type BirthProfile,
} from "@star-sign/core";

const AREA_LABELS: Record<string, string> = {
  communication: "Communication",
  emotional: "Emotional connection",
  attraction: "Attraction",
  friction: "Friction",
  longterm: "Long-term",
};

interface Person {
  id: string;
  display_name: string;
  relation: string;
  birth_date: string | null;
  birth_time: string | null;
  birth_time_precision: "exact" | "approximate" | "unknown";
  birth_time_zone: string | null;
  birth_lat: number | null;
  birth_lon: number | null;
}

export default async function PersonCard({ person }: { person: Person }) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: myProfile } = await supabase
    .from("birth_profiles")
    .select("*")
    .eq("user_id", userData.user!.id)
    .single();

  const hasBothCharts =
    person.birth_date && myProfile && person.birth_lat !== null;

  let report: Awaited<ReturnType<typeof generateCompatibilityReport>> | null =
    null;
  let personSun: string | null = null;

  if (hasBothCharts) {
    const myChartInput: BirthProfile = {
      birthDate: myProfile.birth_date,
      birthTime: myProfile.birth_time ?? undefined,
      birthTimePrecision: myProfile.birth_time_precision,
      birthTimeZone: myProfile.birth_time_zone,
      birthPlace: { lat: myProfile.birth_lat, lon: myProfile.birth_lon },
    };
    const theirChartInput: BirthProfile = {
      birthDate: person.birth_date as string,
      birthTime: person.birth_time ?? undefined,
      birthTimePrecision: person.birth_time_precision,
      birthTimeZone: person.birth_time_zone as string,
      birthPlace: { lat: person.birth_lat!, lon: person.birth_lon! },
    };

    const myChart = computeNatalChart(myChartInput);
    const theirChart = computeNatalChart(theirChartInput);
    personSun = theirChart.placements.find((p) => p.planet === "sun")!.sign;

    report = generateCompatibilityReport({
      a: { userId: myProfile.user_id, displayName: "You", profile: myChartInput },
      b: {
        userId: person.id,
        displayName: person.display_name,
        profile: theirChartInput,
      },
    });
  }

  return (
    <article className="card" style={{ marginBottom: 0 }}>
      <p className="type-prose t-15">{person.display_name}</p>
      <p
        className="type-micro-label t-11"
        style={{
          color: "var(--ink-secondary)",
          marginTop: "var(--space-1)",
        }}
      >
        {person.relation.toUpperCase()}
        {personSun && <> · ☉ {personSun.toUpperCase()}</>}
        {person.birth_time_precision === "unknown" && " · BIRTH TIME UNKNOWN"}
      </p>

      {report && (
        <details>
          <summary className="ui-focusable type-micro-label t-11">
            Compatibility report
          </summary>
          <div
            style={{
              marginTop: "var(--space-3)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            {report.dimensions.map((d) => (
              <div key={d.area}>
                <p className="type-micro-label t-11">
                  {AREA_LABELS[d.area].toUpperCase()}{" "}
                  <span style={{ color: "var(--ink-tertiary)" }}>
                    {"●".repeat(d.tone)}
                    {"○".repeat(5 - d.tone)}
                  </span>
                </p>
                <p
                  className="type-prose t-15"
                  style={{ marginTop: "var(--space-1)" }}
                >
                  {d.summary}
                </p>
              </div>
            ))}
            <p className="type-micro-label t-11" style={{ color: "var(--ink-tertiary)" }}>
              THESE PATTERNS DESCRIBE INTERACTION STYLES, NOT OUTCOMES.
            </p>
            <p style={{ marginTop: "var(--space-1)" }}>
              <a
                href={`/people/${person.id}/report`}
                className="ui-focusable type-micro-label t-11"
                style={{ color: "var(--ink)", textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                Full report — scales & evidence →
              </a>
            </p>
          </div>
        </details>
      )}
    </article>
  );
}
