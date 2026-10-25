/**
 * POST /api/geocode — resolve a place label to coordinates (owner
 * request: the user types "Pune", we know lat/lon — no manual entry).
 *
 * Provider: Open-Meteo geocoding (free, no API key). Results cached in
 * `public.places` so repeated lookups never re-hit the provider. This
 * route is the only network path for geocoding — the client never calls
 * the provider. Without SUPABASE_SERVICE_ROLE_KEY (local/e2e runs), the
 * lookup still works — only the cache is unavailable (graceful
 * degradation; caching is an optimization, not a correctness need).
 */
import { jsonError, jsonOk, parseBody, rateLimit, rateLimitResponse, RATE_LIMITS, requestId, requireActor } from "../_lib/api";
import { z } from "zod";
import { adminClient } from "@/lib/auth/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const geocodeSchema = z.object({
  query: z.string().min(2).max(120),
});

interface OpenMeteoResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  timezone?: string;
}

/** Cache admin client, or null when the service key is absent. */
function cacheClient(): SupabaseClient | null {
  try {
    return adminClient();
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const reqId = requestId();

  const actor = await requireActor(reqId);
  if (!actor.ok) return actor.response;

  const limit = rateLimit(`general:${actor.userId}`, RATE_LIMITS.general);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds, reqId);

  const parsed = await parseBody(req, geocodeSchema, reqId);
  if (!parsed.ok) return parsed.response;

  const normalized = parsed.data.query.trim().toLowerCase();
  const admin = cacheClient();

  // Cache hit? (Only when the service-role key is available.)
  if (admin) {
    const { data: cached } = await admin
      .from("places")
      .select("*")
      .eq("normalized", normalized)
      .maybeSingle();
    if (cached) {
      return jsonOk(
        {
          lat: cached.lat,
          lon: cached.lon,
          resolvedName: cached.resolved_name,
          country: cached.country,
          timezone: cached.timezone,
          cached: true,
        },
        reqId,
      );
    }
  }

  // Provider lookup.
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", parsed.data.query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  let result: OpenMeteoResult | undefined;
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const body = (await res.json()) as { results?: OpenMeteoResult[] };
      result = body.results?.[0];
    }
  } catch {
    // fall through to the not-found path below
  }

  if (!result) {
    return jsonError(
      404,
      "not_found",
      "That place wasn't found. Try a nearby city or check the spelling.",
      reqId,
    );
  }

  // Cache (best-effort and only when the service key exists).
  if (admin) {
    await admin.from("places").upsert(
      {
        label: parsed.data.query.trim(),
        normalized,
        lat: result.latitude,
        lon: result.longitude,
        resolved_name: result.name,
        country: result.country ?? null,
        timezone: result.timezone ?? null,
        source: "open-meteo",
      },
      { onConflict: "normalized" },
    );
  }

  return jsonOk(
    {
      lat: result.latitude,
      lon: result.longitude,
      resolvedName: result.name,
      country: result.country ?? null,
      timezone: result.timezone ?? null,
      cached: false,
    },
    reqId,
  );
}
