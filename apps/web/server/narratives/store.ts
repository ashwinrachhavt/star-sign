/**
 * Supabase-backed NarrativeStore (SERVER-ONLY).
 *
 * Adapts the actor's RLS-scoped Supabase client to the narrate module's
 * persistence boundary — the same ownership model as daily_readings
 * (policies resolve the actor via app.actor_profile_id(), migration 0019).
 */
import {
  narrativeModelIdentity,
  type NarrativeStore,
  type NarrativeScope,
} from "./narrate";

type SupabaseClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

export function supabaseNarrativeStore(supabase: SupabaseClient): NarrativeStore {
  return {
    async findNarrative(userId, scope, forDate, variant) {
      const { data, error } = await supabase
        .from("ai_narratives")
        .select("narrative")
        .eq("user_id", userId)
        .eq("scope", scope)
        .eq("for_date", forDate)
        .eq("variant", variant)
        .maybeSingle();
      if (error) {
        console.error(`[narratives] cache read failed: ${error.message}`);
        return null;
      }
      return data?.narrative ?? null;
    },

    async insertNarrative(row) {
      const model = narrativeModelIdentity();
      const { error } = await supabase.from("ai_narratives").insert({
        user_id: row.userId,
        scope: row.scope,
        for_date: row.forDate,
        variant: row.variant,
        narrative: row.narrative,
        model_name: model.name,
        model_version: model.version,
        prompt_version: model.promptVersion,
        facts_digest: row.factsDigest,
      });
      if (!error) return { ok: true };
      const code = (error as { code?: string }).code;
      if (code === "23505") return { ok: false, code };
      // Storage failure: logged, generation is not retried in-request —
      // the caller returns the narrative uncached (worst case: one extra
      // generation for that user+day later).
      console.error(`[narratives] cache write failed: ${error.message}`);
      return { ok: false, code };
    },
  };
}
