/**
 * POST /api/geocode — resolve a place label to candidate places (owner
 * request: the user types "Pune", we offer "Pune, Maharashtra, India" —
 * they pick one and the form locks its coordinates and zone).
 *
 * Provider: Open-Meteo geocoding (free, no API key). The top candidate
 * is cached in `public.places` so repeated lookups may skip the provider.
 * This route is the only network path for geocoding — the client never
 * calls the provider. Cache operations are best-effort and can never
 * fail the lookup itself (a missing table — a project before migrations
 * run — degrades silently to the provider; caching is an optimization,
 * not a correctness need).
 *
 * Errors are actionable, never ambiguous:
 *   404 not_found            — the provider found no candidates
 *   429 rate_limited         — too many lookups (Retry-After header)
 *   502 upstream_unavailable — the provider could not be reached
 * A provider outage must not masquerade as "no such place".
 */
import { jsonError, jsonOk, parseBody, rateLimit, rateLimitResponse, RATE_LIMITS, requestId, requireActor } from "../_lib/api";
import { z } from "zod";
import { adminClient } from "@/lib/auth/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { geocodeFailureMessage, type PlaceCandidate } from "@/lib/places";

const geocodeSchema = z.object({
  query: z.string().min(2).max(120),
});

/** Typeahead depth: enough to disambiguate, small enough to scan. */
const CANDIDATE_COUNT = 8;

interface OpenMeteoResult {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
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

/**
 * Cache read — null when the cache is unavailable (missing table, no
 * service key, any error). Never throws, never blocks the lookup.
 */
async function readCachedCandidate(
  admin: SupabaseClient,
  normalized: string,
): Promise<PlaceCandidate[] | null> {
  try {
    const { data, error } = await admin
      .from("places")
      .select("resolved_name, country, timezone, lat, lon")
      .eq("normalized", normalized)
      .maybeSingle();
    if (error || !data || data.resolved_name == null || data.lat == null || data.lon == null) {
      return null;
    }
    return [
      {
        name: data.resolved_name,
        admin1: null,
        country: data.country ?? null,
        timezone: data.timezone ?? null,
        lat: data.lat,
        lon: data.lon,
      },
    ];
  } catch {
    return null;
  }
}

/** Cache write — best-effort; a missing table on a fresh deployment must
 * never fail a lookup that already succeeded. */
async function writeCachedCandidate(
  admin: SupabaseClient,
  row: { label: string; normalized: string; candidate: PlaceCandidate },
): Promise<void> {
  try {
    await admin.from("places").upsert(
      {
        label: row.label,
        normalized: row.normalized,
        lat: row.candidate.lat,
        lon: row.candidate.lon,
        resolved_name: row.candidate.name,
        country: row.candidate.country,
        timezone: row.candidate.timezone,
        source: "open-meteo",
      },
      { onConflict: "normalized" },
    );
  } catch {
    // Cache writes are best-effort (see module doc) — degrade quietly.
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
    const cached = await readCachedCandidate(admin, normalized);
    if (cached) {
      return jsonOk({ candidates: cached, cached: true }, reqId);
    }
  }

  // Provider lookup.
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", parsed.data.query);
  url.searchParams.set("count", String(CANDIDATE_COUNT));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  let results: OpenMeteoResult[];
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      // The provider answered with an error status — reachable but
      // unhappy (their rate limiting, their 5xx). Distinct from a
      // no-match: the query may be fine, the service isn't.
      return jsonError(
        502,
        "upstream_unavailable",
        geocodeFailureMessage("upstream_unavailable"),
        reqId,
      );
    }
    const body = (await res.json()) as { results?: OpenMeteoResult[] };
    results = body.results ?? [];
  } catch {
    // Timeout or network failure — provider down, not a bad query.
    return jsonError(
      502,
      "upstream_unavailable",
      geocodeFailureMessage("upstream_unavailable"),
      reqId,
    );
  }

  if (results.length === 0) {
    return jsonError(
      404,
      "not_found",
      geocodeFailureMessage("not_found", parsed.data.query.trim()),
      reqId,
    );
  }

  const candidates: PlaceCandidate[] = results.map((r) => ({
    name: r.name,
    admin1: r.admin1 ?? null,
    country: r.country ?? null,
    timezone: r.timezone ?? null,
    lat: r.latitude,
    lon: r.longitude,
  }));

  // Cache the top candidate (best-effort and only when the service key
  // exists) so repeated lookups for the same label skip the provider.
  if (admin) {
    await writeCachedCandidate(admin, {
      label: parsed.data.query.trim(),
      normalized,
      candidate: candidates[0],
    });
  }

  return jsonOk({ candidates, cached: false }, reqId);
}
