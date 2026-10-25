/**
 * API parity client (ASH-233 / criterion 4): mobile reads and writes via
 * the same REST handlers the web uses, authenticated with the session's
 * bearer token. RLS-direct reads remain for a couple of screen-local
 * lookups only where documented; every mutation goes through the API.
 */
import { supabase } from "./supabase";
import type { ConnectionView, DailyReading } from "@star-sign/core";

function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Expo web/dev default: the Next.js web app's origin.
  return "http://localhost:3000";
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; data?: T; error?: { code: string; message: string } }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 204) return { status: 204 };

  const body = (await res.json().catch(() => ({}))) as {
    data?: T;
    error?: { code: string; message: string };
  };
  return { status: res.status, data: body.data, error: body.error };
}

export interface ApiBirthProfileRow {
  user_id: string;
  birth_date: string;
  birth_time: string | null;
  birth_time_precision: "exact" | "approximate" | "unknown";
  birth_time_zone: string;
  iana_timezone: string | null;
  birth_lat: number;
  birth_lon: number;
  birth_place_label: string | null;
}

/**
 * GET /api/me/birth-profile via the API. Returns null when the profile
 * doesn't exist yet (404-shaped data:null from the handler).
 */
export async function fetchMyBirthProfileApi(): Promise<ApiBirthProfileRow | null> {
  const res = await apiFetch<{ data: ApiBirthProfileRow | null }>(
    "/api/me/birth-profile",
  );
  return res.data?.data ?? null;
}

/**
 * POST /api/daily-readings: ensures the canonical reading for today
 * (create → 201, existing → 200). This is the parity proof for the day
 * screen: same endpoint, same rules as web.
 */
export async function getOrCreateDailyReadingApi(): Promise<DailyReading> {
  const res = await apiFetch<DailyReading>("/api/daily-readings", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (res.status === 409) {
    throw new ApiError(409, res.error?.code ?? "conflict", "Complete onboarding first.");
  }
  if (res.status === 429) {
    throw new ApiError(429, "rate_limited", "Too many requests — try again in a moment.");
  }
  if (!res.data || res.error) {
    throw new ApiError(res.status, res.error?.code ?? "internal_error", res.error?.message ?? "Request failed");
  }
  return res.data;
}

/* ---- Connections (ASH-259 / 5.4) — same REST handlers as web (api.md §7).
   Shared contracts from @star-sign/core; no mobile-only shapes. ---- */

/** GET /api/connections — the actor's connections, both directions. */
export async function listConnectionsApi(): Promise<ConnectionView[]> {
  const res = await apiFetch<ConnectionView[]>("/api/connections");
  if (!res.data || res.error) {
    throw new ApiError(res.status, res.error?.code ?? "internal_error", "Could not load connections.");
  }
  return res.data;
}

/** POST /api/connections — request a connection by user id. */
export async function requestConnectionApi(addresseeId: string): Promise<ConnectionView> {
  const res = await apiFetch<ConnectionView>("/api/connections", {
    method: "POST",
    body: JSON.stringify({ addresseeId }),
  });
  if (res.status === 409) {
    throw new ApiError(409, res.error?.code ?? "conflict", res.error?.message ?? "An active connection already exists.");
  }
  if (res.status === 404) {
    throw new ApiError(404, "not_found", "No one with that id.");
  }
  if (!res.data || res.error) {
    throw new ApiError(res.status, res.error?.code ?? "internal_error", "Could not send request.");
  }
  return res.data;
}

/** PUT /api/connections/{id} — recipient accepts. Idempotent per api.md §8. */
export async function acceptConnectionApi(id: string): Promise<ConnectionView> {
  const res = await apiFetch<ConnectionView>(`/api/connections/${id}`, {
    method: "PUT",
    body: JSON.stringify({}),
  });
  if (!res.data || (res.error && res.status !== 200)) {
    throw new ApiError(res.status, res.error?.code ?? "internal_error", res.error?.message ?? "Could not accept.");
  }
  return res.data;
}

/** DELETE /api/connections/{id} — revoke/decline/disconnect, unilateral + immediate. */
export async function revokeConnectionApi(id: string): Promise<void> {
  const res = await apiFetch(`/api/connections/${id}`, { method: "DELETE" });
  if (res.status !== 204 && res.error) {
    throw new ApiError(res.status, res.error.code, res.error.message ?? "Could not end connection.");
  }
}

/** Partner chart projection (ASH-257 / 5.2) as served by the API. */
export interface PartnerChartProjection {
  connectionId: string;
  state: string;
  placements?: { planet: string; sign: string; house?: number }[];
  consentNote: string;
}

/** GET /api/connections/{id}/chart — the consent-scoped partner chart. */
export async function getPartnerChartApi(id: string): Promise<PartnerChartProjection> {
  const res = await apiFetch<PartnerChartProjection>(`/api/connections/${id}/chart`);
  if (!res.data || res.error) {
    throw new ApiError(res.status, res.error?.code ?? "internal_error", "Could not load chart.");
  }
  return res.data;
}

/** GET /api/people — display names to label connections (owner's own people list). */
export interface ApiPersonRow {
  id: string;
  display_name: string;
}

export async function listPeopleApi(): Promise<ApiPersonRow[]> {
  const res = await apiFetch<{ data: ApiPersonRow[] }>("/api/people");
  return res.data?.data ?? ([] as ApiPersonRow[]);
}
