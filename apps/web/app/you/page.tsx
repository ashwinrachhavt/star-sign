import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  computeNatalChart,
  interpretPlacements,
  type BirthProfile,
  type Planet,
} from "@star-sign/core";
import { bodyGlyph } from "@/components/ui/glyphs";
import { ChartGridPager, PlacementCard, ProfileHeader, ScreenHeader } from "@/components/ui";
import { CelestialMark } from "@/components/ui";
import { rowToBirthProfile } from "@/lib/readings";
import { fontMono } from "@/app/fonts";

export const dynamic = "force-dynamic";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * You → Chart (ASH-267): the personal data screen. Profile header with
 * the big three, the signs × planets × houses grid (paginated), and a
 * card per placement explaining planet meaning, sign expression, and
 * house context — all from the computed chart, never invented.
 */
export default async function YouChartPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");
  const userId = userData.user.id;

  const { data: profileRow } = await supabase
    .from("birth_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profileRow) redirect("/onboarding");

  const { data: profileMeta } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  const profile: BirthProfile = rowToBirthProfile(
    profileRow as unknown as Parameters<typeof rowToBirthProfile>[0],
  );
  const chart = computeNatalChart(profile);
  const cards = interpretPlacements(chart, profile.birthTimePrecision);

  const sun = chart.placements.find((p) => p.planet === "sun")!;
  const moon = chart.placements.find((p) => p.planet === "moon")!;
  const signLine = [
    `☉ ${cap(sun.sign)}`,
    `☽ ${cap(moon.sign)}`,
    chart.ascendant ? `↑ ${cap(chart.ascendant)}` : null,
  ]
    .filter(Boolean)
    .join("   ");

  // Grid rows ordered by house (reference layout: house 1 at top), then
  // grouped into pages. Sign column shows the occupied sign; the house
  // column shows that occupant's house.
  const rows = [
    ...(chart.ascendant
      ? [{ sign: chart.ascendant, glyph: "↑", name: "ASCENDANT", house: 1 as number | undefined }]
      : []),
    ...chart.placements.map((p) => ({
      sign: p.sign,
      glyph: bodyGlyph(p.planet),
      name: p.planet.toUpperCase(),
      house: p.house as number | undefined,
    })),
  ]
    .sort((a, b) => (a.house ?? 99) - (b.house ?? 99));

  const GRID_PAGE_SIZE = 8;
  const pageCount = Math.max(1, Math.ceil(rows.length / GRID_PAGE_SIZE));
  const gridPages = Array.from({ length: pageCount }, (_, page) =>
    rows.slice(page * GRID_PAGE_SIZE, (page + 1) * GRID_PAGE_SIZE).map((r) => ({
      sign: cap(r.sign),
      placements: [{ glyph: r.glyph, name: r.name }],
      house: r.house ?? "—",
    })),
  );

  return (
    <main className="container">
      <ScreenHeader
        title="You"
        tabs={[
          { id: "chart", label: "Chart", href: "/you" },
          { id: "saved", label: "Saved", href: "/you/saved" },
          { id: "settings", label: "Settings", href: "/you/settings" },
        ]}
        activeTab="chart"
      />

      <ProfileHeader
        name={profileMeta?.display_name ?? "You"}
        handle={
          (profileRow as { birth_place_label?: string | null }).birth_place_label ??
          `${profile.birthPlace.lat.toFixed(2)}°, ${profile.birthPlace.lon.toFixed(2)}°`
        }
        signLine={signLine}
        avatar={{ src: "/celestial/icon-27.png", alt: "" }}
      />

      <section style={{ marginTop: "var(--space-6)" }} aria-label="Chart table">
        <ChartGridPager
          pages={gridPages}
          axisLabels={{ left: "Signs", right: "Houses" }}
        />
        {profile.birthTimePrecision !== "exact" && (
          <p
            className={`type-micro-label t-11 ${fontMono.className}`}
            style={{ color: "var(--ink-tertiary)", marginTop: "var(--space-3)", textAlign: "center" }}
          >
            HOUSES AND RISING SIGN OMITTED — BIRTH TIME NOT EXACT
          </p>
        )}
      </section>

      <section style={{ marginTop: "var(--space-7)" }} aria-label="Placement readings">
        {cards.map((card) => (
          <div key={card.title} style={{ position: "relative", marginBottom: "var(--space-6)" }}>
            <PlacementCard title={card.title}>
              {card.paragraphs.map((p, i) => (
                <p key={i} className="type-prose t-17">
                  {p}
                </p>
              ))}
              {card.degree !== undefined && card.planet !== "ascendant" && (
                <p
                  className={`type-micro-label t-11 ${fontMono.className}`}
                  style={{ color: "var(--ink-tertiary)" }}
                >
                  {bodyGlyph(card.planet as Planet)} {card.planet!.toUpperCase()} · {card.degree}° {cap(card.sign)}
                  {card.retrograde ? " · RETROGRADE" : ""}
                </p>
              )}
            </PlacementCard>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                margin: "calc(var(--space-5) * -0.5) 0 var(--space-5)",
                pointerEvents: "none",
              }}
              aria-hidden="true"
            >
              <CelestialMark
                seed={`placement:${card.planet}:${card.sign}`}
                size={120}
                style={{ opacity: 0.92 }}
              />
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
