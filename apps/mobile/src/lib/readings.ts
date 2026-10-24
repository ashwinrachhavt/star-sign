import { type BirthProfile, type DailyReading } from "@star-sign/core";
import { supabase } from "./supabase";

export interface BirthProfileRow {
  user_id: string;
  birth_date: string;
  birth_time: string | null;
  birth_time_precision: "exact" | "approximate" | "unknown";
  birth_time_zone: string;
  birth_lat: number;
  birth_lon: number;
  birth_place_label: string | null;
}

export async function fetchMyBirthProfile(): Promise<BirthProfileRow | null> {
  const { data } = await supabase
    .from("birth_profiles")
    .select("*")
    .limit(1)
    .maybeSingle();
  return (data as BirthProfileRow) ?? null;
}

export async function saveBirthProfile(profile: {
  userId: string;
  birthDate: string;
  birthTime: string | null;
  precision: "exact" | "approximate" | "unknown";
  timeZone: string;
  lat: number;
  lon: number;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from("birth_profiles").upsert({
    user_id: profile.userId,
    birth_date: profile.birthDate,
    birth_time: profile.birthTime,
    birth_time_precision: profile.precision,
    birth_time_zone: profile.timeZone,
    iana_timezone: profile.timeZone,
    birth_lat: profile.lat,
    birth_lon: profile.lon,
  });
  return { error: error?.message ?? null };
}

export function rowToBirthProfile(row: BirthProfileRow): BirthProfile {
  return {
    birthDate: row.birth_date,
    birthTime: row.birth_time ?? undefined,
    birthTimePrecision: row.birth_time_precision,
    birthTimeZone: row.birth_time_zone,
    birthPlace: { lat: row.birth_lat, lon: row.birth_lon, label: row.birth_place_label ?? undefined },
  };
}

export async function getOrCreateDailyReading(
  userId: string,
  forDate: string,
  profile: BirthProfile,
): Promise<{ reading: DailyReading | null; error: string | null }> {
  const { data: existing } = await supabase
    .from("daily_readings")
    .select("*")
    .eq("user_id", userId)
    .eq("for_date", forDate)
    .maybeSingle();

  if (existing) return { reading: rowToReading(existing), error: null };

  const core = await import("@star-sign/core");
  const generated = core.generateDailyReading({ profile, forDate });

  const { data: inserted, error } = await supabase
    .from("daily_readings")
    .insert({
      user_id: userId,
      for_date: forDate,
      headline: generated.headline,
      explanation: generated.explanation,
      dos: generated.dos,
      donts: generated.donts,
      life_areas: generated.lifeAreas,
      ruleset_version: generated.provenance.rulesetVersion,
      copy_version: generated.provenance.copyVersion,
      ephemeris_name: generated.provenance.ephemerisName,
      ephemeris_version: generated.provenance.ephemerisVersion,
      selected_events: generated.provenance.selectedEvents,
      provenance: generated.provenance,
      uncertainty_note: generated.uncertaintyNote,
    })
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") {
      const { data: raced } = await supabase
        .from("daily_readings")
        .select("*")
        .eq("user_id", userId)
        .eq("for_date", forDate)
        .single();
      if (raced) return { reading: rowToReading(raced), error: null };
    }
    return { reading: null, error: error.message };
  }
  return { reading: rowToReading(inserted), error: null };
}

function rowToReading(row: Record<string, unknown>): DailyReading {
  return {
    id: row.id as string,
    forDate: row.for_date as string,
    headline: row.headline as string,
    explanation: row.explanation as string,
    dos: row.dos as string[],
    donts: row.donts as string[],
    lifeAreas: row.life_areas as DailyReading["lifeAreas"],
    provenance: row.provenance as DailyReading["provenance"],
    uncertaintyNote: row.uncertainty_note as string,
  };
}
