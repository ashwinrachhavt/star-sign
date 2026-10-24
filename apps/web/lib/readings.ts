import type { DailyReading } from "@star-sign/core";

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

export function rowToBirthProfile(row: BirthProfileRow) {
  return {
    birthDate: row.birth_date,
    birthTime: row.birth_time ?? undefined,
    birthTimePrecision: row.birth_time_precision,
    birthTimeZone: row.birth_time_zone,
    birthPlace: { lat: row.birth_lat, lon: row.birth_lon, label: row.birth_place_label ?? undefined },
  };
}

export function readingFromRow(row: Record<string, unknown>): DailyReading {
  return {
    id: row.id as string,
    forDate: row.for_date as string,
    headline: row.headline as string,
    explanation: row.explanation as string,
    dos: row.dos as string[],
    donts: row.donts as string[],
    lifeAreas: row.life_areas as never[],
    provenance: row.provenance as never,
    uncertaintyNote: row.uncertainty_note as string,
  };
}

/**
 * Generates and persists today's reading. Idempotent: the unique
 * (user_id, for_date) constraint means a retry returns the stored reading
 * instead of duplicating it (spec §7.3).
 */
export async function getOrCreateDailyReading(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  userId: string,
  forDate: string,
): Promise<DailyReading | { error: string }> {
  const { data: profileRow } = await supabase
    .from("birth_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profileRow) return { error: "no_birth_profile" };

  const { data: existing } = await supabase
    .from("daily_readings")
    .select("*")
    .eq("user_id", userId)
    .eq("for_date", forDate)
    .maybeSingle();

  if (existing) return readingFromRow(existing);

  const profile = rowToBirthProfile(profileRow as BirthProfileRow);
  const reading = await import("@star-sign/core").then((m) =>
    m.generateDailyReading({ profile, forDate }),
  );

  const { data: inserted, error } = await supabase
    .from("daily_readings")
    .insert({
      user_id: userId,
      for_date: forDate,
      headline: reading.headline,
      explanation: reading.explanation,
      dos: reading.dos,
      donts: reading.donts,
      life_areas: reading.lifeAreas,
      provenance: reading.provenance,
      uncertainty_note: reading.uncertaintyNote,
    })
    .select()
    .single();

  if (error) {
    // Unique violation: another request already inserted it — read it back.
    if ((error as { code?: string }).code === "23505") {
      const { data: raced } = await supabase
        .from("daily_readings")
        .select("*")
        .eq("user_id", userId)
        .eq("for_date", forDate)
        .single();
      if (raced) return readingFromRow(raced);
    }
    return { error: error.message };
  }

  return readingFromRow(inserted);
}
