import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { computeNatalChart, ephemerisInfoOf } from "@star-sign/core";
import type { BirthProfile } from "@star-sign/core";
import { ChartTable, PlacementCard, ProvenanceBlock, ScreenHeader, Button } from "@/components/ui";
import Link from "next/link";
import { fontMono } from "@/app/fonts";

export const dynamic = "force-dynamic";

function rowToBirthProfile(row: Record<string, unknown>): BirthProfile {
  return {
    birthDate: row.birth_date as string,
    birthTime: (row.birth_time as string) ?? undefined,
    birthTimePrecision: row.birth_time_precision as BirthProfile["birthTimePrecision"],
    birthTimeZone: row.birth_time_zone as string,
    birthPlace: {
      lat: row.birth_lat as number,
      lon: row.birth_lon as number,
      label: (row.birth_place_label as string) ?? undefined,
    },
  };
}

/**
 * Chart verification screen (ASH-248): shown once after onboarding before
 * any interpretation. Factual summary only — calculation basis, key
 * placements, provenance. Skippable via "Continue"; shown again only if
 * birth details are edited.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const params = await searchParams;
  const alreadyVerified = params.verified === "1";

  const { data: profileRow } = await supabase
    .from("birth_profiles")
    .select("*")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!profileRow) redirect("/onboarding");

  const profile = rowToBirthProfile(profileRow as Record<string, unknown>);
  const chart = computeNatalChart(profile);

  const sun = chart.placements.find((p) => p.planet === "sun");
  const moon = chart.placements.find((p) => p.planet === "moon");
  const exact = profile.birthTimePrecision === "exact";

  const precisionCopy: Record<BirthProfile["birthTimePrecision"], string> = {
    exact: "You gave an exact birth time — houses and rising sign are calculated from it.",
    approximate:
      "Your birth time is approximate, so rising sign and houses are omitted. Sign placements are solid; the Moon could be off by a few degrees.",
    unknown:
      "No birth time was given, so rising sign and houses cannot be calculated — they are omitted, not guessed. The Moon's sign may differ from what's shown.",
  };

  const capKey = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);

  type VerifyRow = { sign: string; placements: string; house: string | number };
  const chartRows: VerifyRow[] = [
    sun && {
      sign: capKey(sun.sign),
      placements: `Sun${exact && sun.house ? ` · house ${sun.house}` : ""}`,
      house: exact && sun.house ? sun.house : "—",
    },
    moon && {
      sign: capKey(moon.sign),
      placements: `Moon${exact && moon.house ? ` · house ${moon.house}` : ""}`,
      house: exact && moon.house ? moon.house : "—",
    },
    chart.ascendant && {
      sign: capKey(chart.ascendant),
      placements: "Rising (Ascendant)",
      house: "1",
    },
  ].filter((r): r is VerifyRow => Boolean(r));

  const ephemeris = ephemerisInfoOf({
    rulesetVersion: "",
    copyVersion: "",
    ephemerisName: "astronomy-engine",
    ephemerisVersion: "2.1.19",
    selectedEvents: [],
    calculatedAt: "",
    inputs: [],
  });

  return (
    <main className="container">
      <ScreenHeader title="Star Sign" tabs={[]} />

      <PlacementCard title="Is this you?">
        <p className="type-prose t-17">
          {profile.birthDate}
          {profile.birthTime ? ` at ${profile.birthTime}` : ""}
          {" · "}
          {profile.birthPlace.label ?? `${profile.birthPlace.lat.toFixed(2)}°, ${profile.birthPlace.lon.toFixed(2)}°`}
        </p>
        <p className={`type-mono t-13 ${fontMono.className}`}>
          {precisionCopy[profile.birthTimePrecision]}
        </p>
      </PlacementCard>

      <ChartTable rows={chartRows} />

      <ProvenanceBlock summary="How we calculated this">
        <p>
          Positions: {ephemeris.name} v{ephemeris.version} (astronomical ephemeris library).
          Zodiac: tropical. Houses: {chart.houses ? "Porphyry" : "not calculated (birth time missing or approximate)"}.
          Time precision: {profile.birthTimePrecision}.
        </p>
        <p>
          What changes if your birth time is approximate? Rising sign changes roughly every two
          hours and house positions shift throughout the day — that&apos;s why we omit them instead
          of guessing. Sign placements of the Sun and planets are stable; the Moon moves about one
          sign per 2.5 days.
        </p>
      </ProvenanceBlock>

      <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
        <Link href="/day">
          <Button variant="solid">That&apos;s me — continue</Button>
        </Link>
        <Link href={`/onboarding?edit=1${alreadyVerified ? "&return=verify" : ""}`}>
          <Button variant="link">Edit birth details</Button>
        </Link>
      </div>
    </main>
  );
}
