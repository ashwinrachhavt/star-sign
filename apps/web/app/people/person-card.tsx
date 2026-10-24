import { createClient } from "@/lib/supabase/server";
import {
  computeNatalChart,
  generateCompatibilityReport,
  type BirthProfile,
} from "@our-sky/core";

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
    <div className="card">
      <h2 style={{ fontSize: "1.2rem", marginBottom: 4 }}>
        {person.display_name}
      </h2>
      <p className="muted" style={{ marginBottom: 10 }}>
        {person.relation}
        {personSun && <> · Sun in {personSun}</>}
        {person.birth_time_precision === "unknown" && " · birth time unknown"}
      </p>

      {report && (
        <details>
          <summary>Compatibility report</summary>
          <div style={{ marginTop: 12 }}>
            {report.dimensions.map((d) => (
              <div key={d.area} style={{ marginBottom: 12 }}>
                <p style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                  {AREA_LABELS[d.area]}{" "}
                  <span className="muted">
                    {"●".repeat(d.tone)}
                    {"○".repeat(5 - d.tone)}
                  </span>
                </p>
                <p style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
                  {d.summary}
                </p>
              </div>
            ))}
            <p className="muted" style={{ fontSize: "0.8rem" }}>
              These patterns describe interaction styles, not outcomes. Ruleset{" "}
              {report.provenance.rulesetVersion}.
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
