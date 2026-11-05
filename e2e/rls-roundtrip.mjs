#!/usr/bin/env node
// RLS round-trip proof against the LIVE Supabase project (Star Sign).
//
// Run AFTER the full schema bundle (/tmp/supabase-full-schema.sql) is applied.
// Self-contained: provisions two identities through the app's own provisioning
// path (GoTrue admin anchor → signup-trigger profile → clerk_subject mapping —
// mirrors lib/auth/sql-admin.ts provisionClerkProfileViaSql), mints REAL Clerk
// session JWTs (mint-clerk-jwt.mjs, the live-verify ticket flow), then records
// the RLS matrix from live PostgREST responses:
//
//   owner  : GET birth_profiles        → own row visible
//   other  : GET birth_profiles        → owner's rows invisible (0 rows)
//   other  : GET birth_profiles by id  → still invisible
//   anon   : GET birth_profiles        → blocked (0 rows / 401 — recorded)
//   service: GET birth_profiles        → bypasses RLS, sees the row
//
// Exit 0 = matrix passed; exit 2 = preconditions missing (schema/Clerk auth);
// exit 1 = matrix MISMATCH (an RLS or provisioning failure).
//
// Usage: node rls-roundtrip.mjs [--cleanup]
// Env:   SECRET_SUPABASE_URL (or hard-coded LIVE_URL), SECRET_SUPABASE_ANON_KEY,
//        SECRET_SUPABASE_SERVICE_ROLE_KEY, SECRET_CLERK_SECRET_KEY,
//        SECRET_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
// Out:   /tmp/journey/rls-matrix.json (+ console table)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIVE_URL = process.env.SECRET_SUPABASE_URL && process.env.SECRET_SUPABASE_URL !== "NA"
  ? process.env.SECRET_SUPABASE_URL
  : "https://dgbjaokzsmkbggupcfzo.supabase.co"; // vault SUPABASE_URL entry is stale ("NA")
const ANON = process.env.SECRET_SUPABASE_ANON_KEY;
const SERVICE = process.env.SECRET_SUPABASE_SERVICE_ROLE_KEY;
const OUT = "/tmp/journey";

const MIGRATION_TABLES = [
  "profiles", "birth_profiles", "daily_readings", "people", "compatibility_reports", "reflections",
  "job_run_logs", "sky_events", "connections", "connection_state_log",
  "notification_preferences", "notification_dispatch_log", "onboarding_profiles", "places",
];

if (!ANON || !SERVICE) throw new Error("missing Supabase keys in env");
fs.mkdirSync(OUT, { recursive: true });
const log = (m) => console.log(m);

async function rest(path, { method = "GET", key = ANON, bearer = null, body = null, prefer = null } = {}) {
  const headers = { apikey: key };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  if (body !== null) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${LIVE_URL}${path}`, { method, headers, body: body === null ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text.slice(0, 300); }
  return { status: r.status, json };
}

function record(name, { status, json }, expect, pass) {
  const rows = Array.isArray(json) ? json.length : null;
  log(`  ${pass ? "PASS" : "FAIL"}  ${name}: HTTP ${status}${rows !== null ? ` rows=${rows}` : ""}${pass ? "" : `  (expected: ${expect})`}`);
  return { name, expect, status, rows, passed: pass, sample: Array.isArray(json) ? json[0] ?? null : json };
}

// Cleanup mode: remove the two test identities (auth.users delete cascades to
// profiles and all owned data through the 0001 FK chain).
if (process.argv.includes("--cleanup")) {
  log("\ncleanup: deleting test identities (cascades to profiles + birth data)…");
  for (const role of ["owner", "other"]) {
    const file = `${OUT}/jwt-${role}.json`;
    if (!fs.existsSync(file)) continue;
    const { claims } = JSON.parse(fs.readFileSync(file, "utf8"));
    const email = `rls-${role}-${claims.sub.slice(-10).toLowerCase()}@starsign-test.dev`;
    const found = await rest(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { key: SERVICE });
    for (const u of found.json?.users ?? []) {
      const del = await rest(`/auth/v1/admin/users/${u.id}`, { method: "DELETE", key: SERVICE });
      log(`  ${role}: auth user ${u.id} deleted (HTTP ${del.status})`);
    }
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 0. Preconditions: schema applied + Clerk third-party auth accepted.
// ---------------------------------------------------------------------------
log(`live project: ${LIVE_URL}`);

const root = await rest("/rest/v1/", { key: SERVICE });
const defs = root.json?.definitions ?? root.json?.components?.schemas ?? {};
const exposed = Object.keys(defs).sort();
const missing = MIGRATION_TABLES.filter((t) => !exposed.includes(t));
const extra = exposed.filter((t) => !MIGRATION_TABLES.includes(t));
log(`OpenAPI exposed tables (${exposed.length}): ${exposed.join(", ") || "NONE"}`);
if (missing.length) {
  log(`MISSING vs migration set: ${missing.join(", ")}`);
  log("→ schema not applied yet. Paste /tmp/supabase-full-schema.sql into the Supabase SQL editor, then re-run.");
  process.exit(2);
}
if (extra.length) log(`note — exposed but not in migration set: ${extra.join(", ")}`);

// Clerk third-party auth check: a fresh Clerk JWT must decode (not PGRST301).
log("\nminting fresh Clerk session JWTs (ticket flow)…");
const here = path.dirname(fileURLToPath(import.meta.url));
const mint = spawnSync("node", [path.join(here, "mint-clerk-jwt.mjs")], { stdio: "inherit" });
if (mint.status !== 0) {
  log("mint failed — see mint-clerk-jwt.mjs output above");
  process.exit(2);
}
const ownerJwt = JSON.parse(fs.readFileSync(`${OUT}/jwt-owner.json`, "utf8"));
const otherJwt = JSON.parse(fs.readFileSync(`${OUT}/jwt-other.json`, "utf8"));
log(`JWTs minted: owner=${ownerJwt.claims.sub} other=${otherJwt.claims.sub}`);

// Clerk third-party auth check: when Clerk auth is configured on the project
// this read decodes the JWT and returns 200/404-per-table; PGRST301 401 means
// the project does not accept Clerk tokens yet (Dashboard → Third-Party Auth).
const probe = await rest("/rest/v1/birth_profiles?select=user_id&limit=1", { bearer: ownerJwt.jwt });
if (probe.status === 401) {
  log(`\nClerk JWT rejected by PostgREST (HTTP 401): ${JSON.stringify(probe.json).slice(0, 200)}`);
  log("→ Supabase third-party auth for Clerk is not configured (Dashboard → Authentication → Third-Party Auth → add the Clerk domain included-mole-1154.clerk.accounts.dev), or the Clerk JWKS is unreachable. The RLS matrix cannot be recorded without it.");
  process.exit(2);
}

// ---------------------------------------------------------------------------
// 1. Provision two identities exactly like the app bridge does
//    (GoTrue anchor + trigger profile + subject mapping), service-role writes.
// ---------------------------------------------------------------------------
log("\nprovisioning identities (GoTrue admin anchor → trigger profile → subject map)…");

async function provision(role, clerkSub, displayName) {
  const email = `rls-${role}-${clerkSub.slice(-10).toLowerCase()}@starsign-test.dev`;
  // Idempotent: reuse by email if a previous run left it.
  const found = await rest(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { key: SERVICE });
  let userId = found.json?.users?.[0]?.id;
  if (!userId) {
    const created = await rest("/auth/v1/admin/users", {
      method: "POST", key: SERVICE,
      body: { email, password: `Sg-${crypto.randomUUID().slice(0, 13)}!7`, email_confirm: true, user_metadata: { display_name: displayName, provider: "clerk" } },
    });
    if (created.status !== 201 && created.status !== 200) {
      log(`  FAIL anchor (${role}): HTTP ${created.status} ${JSON.stringify(created.json).slice(0, 200)}`);
      return null;
    }
    userId = created.json.id;
  }
  // The 0001 signup trigger should have created the profile; repair if the
  // APPENDIX-A trigger was skipped on live (FK is satisfied by the anchor).
  let prof = await rest(`/rest/v1/profiles?id=eq.${userId}&select=id,clerk_subject,handle`, { key: SERVICE });
  if (!Array.isArray(prof.json) || prof.json.length === 0) {
    await rest("/rest/v1/profiles", { method: "POST", key: SERVICE, body: { id: userId, display_name: displayName }, prefer: "return=representation" });
  }
  // Map the Clerk subject onto the profile (bridge parity) + display name.
  await rest(`/rest/v1/profiles?id=eq.${userId}`, { method: "PATCH", key: SERVICE, body: { clerk_subject: clerkSub, auth_provider: "clerk", display_name: displayName } });
  prof = await rest(`/rest/v1/profiles?id=eq.${userId}&select=id,clerk_subject,handle,display_name`, { key: SERVICE });
  log(`  ${role}: anchor=${userId} profile=${prof.json?.[0]?.id ?? "?"} handle=${prof.json?.[0]?.handle ?? "?"} subject-mapped=${prof.json?.[0]?.clerk_subject === clerkSub}`);
  return userId;
}

const ownerUid = await provision("owner", ownerJwt.claims.sub, "RLS Owner");
const otherUid = await provision("other", otherJwt.claims.sub, "RLS Other");
if (!ownerUid || !otherUid) process.exit(1);

// One birth profile for the owner (service-role write; RLS would allow the owner anyway).
await rest(`/rest/v1/birth_profiles?user_id=eq.${ownerUid}`, { method: "DELETE", key: SERVICE });
const bp = await rest("/rest/v1/birth_profiles", {
  method: "POST", key: SERVICE, prefer: "return=representation",
  body: { user_id: ownerUid, birth_date: "1990-06-15", birth_time: "14:30:00", birth_time_precision: "exact", birth_time_zone: "America/Los_Angeles", iana_timezone: "America/Los_Angeles", birth_lat: 34.0522, birth_lon: -118.2437, birth_place_label: "Los Angeles, CA, USA" },
});
if (bp.status !== 201) { log(`FAIL birth_profiles seed: HTTP ${bp.status} ${JSON.stringify(bp.json).slice(0, 200)}`); process.exit(1); }
log(`  owner birth_profiles row seeded (user_id=${ownerUid})`);

// ---------------------------------------------------------------------------
// 2. RLS matrix — every cell from a live response.
// ---------------------------------------------------------------------------
log("\nRLS matrix (live responses):");
const results = [];

const ownerRead = await rest("/rest/v1/birth_profiles", { bearer: ownerJwt.jwt });
results.push(record("owner reads birth_profiles", ownerRead, "HTTP 200, 1 row (own)", ownerRead.status === 200 && Array.isArray(ownerRead.json) && ownerRead.json.length === 1 && ownerRead.json[0].user_id === ownerUid));

const otherRead = await rest("/rest/v1/birth_profiles", { bearer: otherJwt.jwt });
results.push(record("other user reads birth_profiles", otherRead, "HTTP 200, 0 rows (invisible)", otherRead.status === 200 && Array.isArray(otherRead.json) && otherRead.json.length === 0));

const otherById = await rest(`/rest/v1/birth_profiles?user_id=eq.${ownerUid}`, { bearer: otherJwt.jwt });
results.push(record("other user reads owner's birth_profiles by id", otherById, "HTTP 200, 0 rows (invisible)", otherById.status === 200 && Array.isArray(otherById.json) && otherById.json.length === 0));

const anonRead = await rest("/rest/v1/birth_profiles");
results.push(record("anon reads birth_profiles (no bearer)", anonRead, "HTTP 200 with 0 rows, or 401 (RLS-fail-closed)", (anonRead.status === 200 && Array.isArray(anonRead.json) && anonRead.json.length === 0) || anonRead.status === 401));

const svcRead = await rest("/rest/v1/birth_profiles", { key: SERVICE, bearer: SERVICE });
results.push(record("service role reads birth_profiles (RLS bypass)", svcRead, "HTTP 200, 1 row", svcRead.status === 200 && Array.isArray(svcRead.json) && svcRead.json.length === 1));

const ownerProfiles = await rest("/rest/v1/profiles", { bearer: ownerJwt.jwt });
results.push(record("owner reads profiles", ownerProfiles, "HTTP 200, 1 row (own only)", ownerProfiles.status === 200 && Array.isArray(ownerProfiles.json) && ownerProfiles.json.length === 1 && ownerProfiles.json[0].id === ownerUid));

const otherProfiles = await rest("/rest/v1/profiles", { bearer: otherJwt.jwt });
results.push(record("other user reads profiles", otherProfiles, "HTTP 200, 1 row (own only)", otherProfiles.status === 200 && Array.isArray(otherProfiles.json) && otherProfiles.json.length === 1 && otherProfiles.json[0].id === otherUid));

const otherDaily = await rest(`/rest/v1/daily_readings?user_id=eq.${ownerUid}`, { bearer: otherJwt.jwt });
results.push(record("other user reads owner's daily_readings", otherDaily, "HTTP 200, 0 rows", otherDaily.status === 200 && Array.isArray(otherDaily.json) && otherDaily.json.length === 0));

// Cross-user write attempt: other must NOT be able to write into owner's profile.
// RLS using()-filters the update to 0 rows (HTTP 204); verify the row really
// changed nothing via a service-role readback.
await rest(`/rest/v1/profiles?id=eq.${ownerUid}`, { method: "PATCH", bearer: otherJwt.jwt, body: { display_name: "HACKED" } });
const crossReadback = await rest(`/rest/v1/profiles?id=eq.${ownerUid}&select=display_name`, { key: SERVICE, bearer: SERVICE });
const untampered = crossReadback.json?.[0]?.display_name === "RLS Owner";
results.push(record("other user PATCHes owner's profile", crossReadback, "owner row unchanged after cross-user write attempt", untampered));

const passed = results.filter((r) => r.passed).length;
const matrix = {
  recorded_at: new Date().toISOString(),
  live_url: LIVE_URL,
  owner_clerk_sub: ownerJwt.claims.sub,
  other_clerk_sub: otherJwt.claims.sub,
  owner_profile_id: ownerUid,
  other_profile_id: otherUid,
  exposed_tables: exposed,
  results,
  verdict: passed === results.length ? "ALL PASS — owner sees own row, other user isolated, anon blocked" : `${results.length - passed} FAILURE(S)`,
};
fs.writeFileSync(`${OUT}/rls-matrix.json`, JSON.stringify(matrix, null, 2));
fs.writeFileSync(`${OUT}/rls-matrix.md`, [
  `# RLS round-trip matrix — live ${LIVE_URL}`,
  ``,
  `Recorded ${matrix.recorded_at} · owner \`${ownerJwt.claims.sub}\` → profile \`${ownerUid}\` · other \`${otherJwt.claims.sub}\` → profile \`${otherUid}\``,
  ``,
  `| check | result | expected | verdict |`,
  `|---|---|---|---|`,
  ...results.map((r) => `| ${r.name} | HTTP ${r.status}${r.rows !== null ? ` (${r.rows} rows)` : ""} | ${r.expect} | ${r.passed ? "PASS" : "FAIL"} |`),
  ``,
  `**${matrix.verdict}**`,
].join("\n"));

log(`\n${passed}/${results.length} checks passed — ${matrix.verdict}`);
log(`matrix written → ${OUT}/rls-matrix.json, ${OUT}/rls-matrix.md`);
process.exit(passed === results.length ? 0 : 1);
