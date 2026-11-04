import {
  computeNatalChart,
  generateCompatibilityReport,
  type BirthProfile,
} from "@star-sign/core";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import {
  Button,
  ProvenanceBlock,
  ScreenHeader,
} from "@/components/ui";
import { fontMono } from "@/app/fonts";

/* Local glyph maps until PR #28 (glyphs.ts) merges — swap to
   @/components/ui/glyphs then. Kept value-identical to that module. */
const BODY_GLYPHS: Record<string, string> = {
  sun: "☉", moon: "☽", mercury: "☿", venus: "♀", mars: "♂",
  jupiter: "♃", saturn: "♄", uranus: "♅", neptune: "♆", pluto: "♇",
};
const ASPECT_GLYPHS: Record<string, string> = {
  conjunction: "☌", opposition: "☍", square: "□", trine: "△", sextile: "⚹",
};
function bodyGlyph(p: string): string {
  return BODY_GLYPHS[p] ?? "•";
}
function aspectGlyph(a: string): string {
  return ASPECT_GLYPHS[a] ?? "·";
}

const AREA_LABELS: Record<string, string> = {
  communication: "Communication",
  emotional: "Emotional connection",
  attraction: "Attraction",
  friction: "Friction",
  longterm: "Long-term",
};

/** Reflection questions per domain (copy.md: reflection, never verdict). */
const AREA_QUESTIONS: Record<string, string> = {
  communication: "How do words move between you?",
  emotional: "What do you sense without being told?",
  attraction: "What draws you in, and what holds?",
  friction: "Where do you sharpen each other?",
  longterm: "What pace do your lives keep together?",
};

interface Person {
  id: string;
  owner_id: string;
  display_name: string;
  relation: string;
  birth_date: string | null;
  birth_time: string | null;
  birth_time_precision: "exact" | "approximate" | "unknown";
  birth_time_zone: string | null;
  birth_lat: number | null;
  birth_lon: number | null;
}

function profileFromRow(row: Record<string, unknown>): BirthProfile {
  return {
    birthDate: row.birth_date as string,
    birthTime: (row.birth_time as string) ?? undefined,
    birthTimePrecision: row.birth_time_precision as BirthProfile["birthTimePrecision"],
    birthTimeZone: row.birth_time_zone as string,
    birthPlace: { lat: row.birth_lat as number, lon: row.birth_lon as number },
  };
}

/** Monochrome 5-dot scale — the declared 1–5 tone, never a percentage. */
function ToneScale({ tone }: { tone: number }) {
  return (
    <span
      className={`type-mono ${fontMono.className}`}
      aria-label={`Tone ${tone} of 5`}
      style={{ color: "var(--ink)" }}
    >
      {"●".repeat(tone)}
      <span style={{ color: "var(--ink-tertiary)" }}>{"○".repeat(5 - tone)}</span>
    </span>
  );
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { id } = await params;

  // RLS scoping: people rows are owner-only (0001 policy), so a foreign id
  // returns no row → 404, never a leak (AC3).
  const { data: person } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .eq("owner_id", userData.user.id)
    .maybeSingle();

  if (!person) notFound();

  const p = person as unknown as Person;
  if (!p.birth_date || p.birth_lat === null || !p.birth_time_zone) {
    return (
      <main className="container">
        <ScreenHeader
          title={p.display_name}
          tabs={[
            { id: "day", label: "My Day", href: "/day" },
            { id: "week", label: "Week", href: "/week" },
            { id: "people", label: "People", href: "/people" },
            { id: "you", label: "You", href: "/you" },
          ]}
          activeTab="people"
        />
        <p className="type-prose t-15" style={{ color: "var(--ink-secondary)", marginTop: "var(--space-5)" }}>
          This report needs their birth details — add date, time zone, and
          place on the People screen to generate it.
        </p>
      </main>
    );
  }

  const { data: myProfile } = await supabase
    .from("birth_profiles")
    .select("*")
    .eq("user_id", userData.user.id)
    .single();

  if (!myProfile) redirect("/onboarding");

  const myChartInput = profileFromRow(myProfile as unknown as Record<string, unknown>);
  const theirChartInput = profileFromRow(p as unknown as Record<string, unknown>);

  const myChart = computeNatalChart(myChartInput);
  const theirChart = computeNatalChart(theirChartInput);

  const report = generateCompatibilityReport({
    a: { userId: userData.user.id, displayName: "You", profile: myChartInput },
    b: { userId: p.id, displayName: p.display_name, profile: theirChartInput },
  });

  // The synastry grid (recorded in provenance.selectedEvents) is the
  // evidence trail: each domain's score traces to its planet pairs.
  const gridAspects = report.provenance.selectedEvents.filter(
    (e) => e.kind === "transit",
  );

  function evidenceFor(area: string): string[] {
    const PAIRS: Record<string, Array<[string, string]>> = {
      communication: [["mercury", "mercury"], ["mercury", "moon"], ["sun", "mercury"], ["mercury", "ascendant"]],
      emotional: [["moon", "moon"], ["moon", "venus"], ["moon", "sun"], ["venus", "moon"]],
      attraction: [["venus", "mars"], ["mars", "venus"], ["venus", "venus"], ["mars", "mars"]],
      friction: [["mars", "mars"], ["mars", "saturn"], ["sun", "saturn"], ["moon", "saturn"]],
      longterm: [["saturn", "saturn"], ["jupiter", "sun"], ["sun", "moon"], ["jupiter", "moon"]],
    };
    const wanted = PAIRS[area] ?? [];
    const lines: string[] = [];
    for (const e of gridAspects) {
      if (e.kind !== "transit") continue;
      if (
        wanted.some(
          ([x, y]) => (e.planet === x && e.natal === y) || (e.planet === y && e.natal === x),
        )
      ) {
        lines.push(
          `${bodyGlyph(e.planet)} ${e.planet.charAt(0).toUpperCase() + e.planet.slice(1)} ${aspectGlyph(e.aspect ?? "")} ${e.natal.charAt(0).toUpperCase() + e.natal.slice(1)}`,
        );
      }
    }
    return lines;
  }

  return (
    <main className="container">
      <ScreenHeader
        title={p.display_name}
        tabs={[
          { id: "day", label: "My Day", href: "/day" },
          { id: "week", label: "Week", href: "/week" },
          { id: "people", label: "People", href: "/people" },
          { id: "you", label: "You", href: "/you" },
        ]}
        activeTab="people"
      />

      <p
        className={`type-micro-label t-11 ${fontMono.className}`}
        style={{ color: "var(--ink-secondary)", marginTop: "var(--space-4)" }}
      >
        {p.relation.toUpperCase()} · ☉ {theirChart.placements.find((pl) => pl.planet === "sun")!.sign.toUpperCase()} /{" "}
        ☉ {myChart.placements.find((pl) => pl.planet === "sun")!.sign.toUpperCase()}
      </p>

      <p className="type-prose t-15" style={{ color: "var(--ink-secondary)", marginTop: "var(--space-3)" }}>
        A reflection on interaction styles — how two charts tend to move
        together. Patterns, not outcomes; you decide what they mean.
      </p>

      <div
        style={{
          marginTop: "var(--space-5)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        {report.dimensions.map((d) => {
          const evidence = evidenceFor(d.area);
          return (
            <section className="card" key={d.area}>
              <p
                className={`type-micro-label t-11 ${fontMono.className}`}
                style={{ color: "var(--ink-tertiary)" }}
              >
                {AREA_QUESTIONS[d.area]}
              </p>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginTop: "var(--space-2)",
                }}
              >
                <h2 className="type-display t-22">{AREA_LABELS[d.area]}</h2>
                <ToneScale tone={d.tone} />
              </div>
              <p className="type-prose t-15" style={{ marginTop: "var(--space-3)" }}>
                {d.summary}
              </p>
              {evidence.length > 0 && (
                <details style={{ marginTop: "var(--space-3)" }}>
                  <summary
                    className={`ui-focusable type-micro-label t-11 ${fontMono.className}`}
                    style={{ color: "var(--ink-tertiary)" }}
                  >
                    The aspects behind this
                  </summary>
                  <div style={{ marginTop: "var(--space-2)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    {evidence.map((line, i) => (
                      <span
                        key={i}
                        className={`type-mono t-13 ${fontMono.className}`}
                        style={{ color: "var(--ink-secondary)" }}
                      >
                        {line}
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </section>
          );
        })}
      </div>

      <section style={{ marginTop: "var(--space-5)" }}>
        <ProvenanceBlock>
          <span>Synastry ruleset {report.provenance.rulesetVersion} · copy {report.provenance.copyVersion}</span>
          <span>{gridAspects.length} cross-chart aspects computed from both charts</span>
          <span>Calculated {new Date(report.provenance.calculatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</span>
        </ProvenanceBlock>
      </section>

      <section style={{ marginTop: "var(--space-4)", marginBottom: "var(--space-8)" }}>
        <Button variant="link" href="/people">
          Back to people
        </Button>
      </section>
    </main>
  );
}
