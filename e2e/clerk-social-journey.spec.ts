/**
 * Clerk-social journey (W4): the whole product end to end, without a live
 * Clerk handshake (owner decision: no live keys today).
 *
 * Stubbed session: a synthetic dev JWT whose sub matches the seeded
 * profile's clerk_subject, injected as the @supabase/ssr session cookie
 * (see helpers.ts). GoTrue validates the token, the app code runs
 * unmodified, and PostgREST enforces RLS v3 — the Clerk SDK handshake is
 * the one uncovered seam, flagged in the PR.
 *
 * Legs: onboard → today reading (canonical, idempotent) → add by exact
 * handle → accept → personalized friend update → compatibility report →
 * revoke → shared access gone (fail-closed + 404). Screenshots + session
 * video land in artifacts/ as dogfood evidence for the tested head SHA.
 */
import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { databaseUrl, seedStubUser, stubSessionCookie } from "./helpers";

test.use({ video: "on" });

const sql = postgres(databaseUrl(), { max: 1, onnotice: () => {} });
test.afterAll(async () => {
  await sql.end();
});

/** The actor's canonical reading rows (service-level read, never via the UI). */
function readingRows(profileId: string) {
  return sql`select id, headline, for_date from daily_readings where user_id = ${profileId}::uuid`;
}

const PLANETS = /sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto/i;

test("journey: onboard → today → connect by handle → accept → friend update → report → revoke", async ({
  browser,
}) => {
  test.setTimeout(240_000);

  // Two identities through the production SQL bridge channel. Maya is fully
  // seeded (birth basis + handle); Ari onboards through the real UI.
  const maya = await seedStubUser(sql, {
    email: "e2e-beta@star-sign.test",
    password: "e2e-maya-pass-1",
    displayName: "Maya",
    handle: "maya-orion",
    birth: {
      date: "1992-03-08",
      time: "14:45",
      zone: "America/Los_Angeles",
      lat: 34.0522,
      lon: -118.2437,
      label: "Los Angeles",
    },
  });
  const ari = await seedStubUser(sql, {
    email: "e2e-alpha@star-sign.test",
    password: "e2e-ari-pass-1",
    displayName: "Ari",
  });

  // --- Ari: stubbed Clerk session → onboarding through the real UI ---
  const ctxA = await browser.newContext();
  await ctxA.addCookies([{ ...stubSessionCookie(ari.session), url: "http://localhost:3010" }]);
  const a = await ctxA.newPage();

  await a.goto("/onboarding");
  await a.getByLabel("Birth date").fill("1990-06-15");
  await a.getByLabel("Time", { exact: true }).fill("09:30");
  await a.getByLabel("Time zone at birth").fill("America/New_York");
  // Geocoded place: coordinates resolve server-side (owner request).
  await a.getByLabel("Birth place").fill("New York");
  await a.getByText(/New York.*\d+\.\d+°/).waitFor({ timeout: 15_000 });
  await a.getByRole("button", { name: /continue/i }).click();

  // Chart verification screen: factual summary before interpretation.
  await a.waitForURL("**/verify", { timeout: 15_000 });
  await expect(a.getByText("Is this you?")).toBeVisible({ timeout: 15_000 });
  await a.screenshot({ path: "artifacts/tc-1-verify.png" });
  await a.getByRole("link", { name: /that's me/i }).click();

  // --- Today: the reading ritual, canonical + idempotent ---
  await a.waitForURL("**/day", { timeout: 15_000 });
  await expect(a.locator("h2.type-display")).toBeVisible({ timeout: 20_000 });
  await expect(a.getByText("Dos")).toBeVisible();
  const headline = (await a.locator("h2.type-display").textContent())!.trim();
  expect(headline.length).toBeGreaterThan(0);

  const rows = await readingRows(ari.profileId);
  expect(rows).toHaveLength(1); // canonical creation ran
  await a.screenshot({ path: "artifacts/tc-2-day.png" });

  // Reload: same headline, still exactly one row (idempotent, no dupes).
  await a.reload();
  await expect(a.locator("h2.type-display")).toHaveText(headline, { timeout: 20_000 });
  expect(await readingRows(ari.profileId)).toHaveLength(1);

  // --- Pro-tier feel, asserted in-journey ---
  // Temperatures: the full area set with at least two distinct states.
  const states = await a.locator(".ui-life-area-row-state").allTextContents();
  expect(states.length).toBeGreaterThanOrEqual(5);
  expect(new Set(states).size).toBeGreaterThanOrEqual(2);
  // Proof lines: each rendered do/don't pairs with a named-transit grounding.
  const proofs = (await a.locator(".ui-dos-donts-list li > span").allTextContents()).filter(
    (t) => t.trim().length > 0,
  );
  expect(proofs.length).toBeGreaterThan(0);
  expect(proofs.join(" ")).toMatch(PLANETS);

  // --- Add Maya by exact handle ---
  await a.getByRole("link", { name: "People" }).click();
  await a.waitForURL("**/people", { timeout: 15_000 });
  await a.getByPlaceholder(/their handle/i).fill("@maya-orion");
  await a.getByRole("button", { name: /send request/i }).click();
  // Match the form-status sentence, not the row badge ("REQUEST SENT.
  // THEY HAVEN'T ANSWERED YET") — both render; strict mode needs one.
  await expect(a.getByText(/Request sent\. They'll see it/i)).toBeVisible({
    timeout: 10_000,
  });
  await expect(a.getByText(/WAITING FOR THEIR YES/i)).toBeVisible();
  await a.screenshot({ path: "artifacts/tc-3-request-sent.png" });

  const connId = (
    await sql`select id from connections where requester_id = ${ari.profileId}::uuid and state = 'requested'`
  )[0]?.id as string | undefined;
  expect(connId).toBeTruthy();

  // --- Maya: accept through the real consent surface ---
  const ctxB = await browser.newContext();
  await ctxB.addCookies([{ ...stubSessionCookie(maya.session), url: "http://localhost:3010" }]);
  const b = await ctxB.newPage();

  await b.goto("/people");
  await expect(b.getByText(/THEY WANT TO CONNECT/i)).toBeVisible({ timeout: 15_000 });
  await b.getByRole("link", { name: /review & decide/i }).click();
  await b.waitForURL(`**/connections/${connId}`, { timeout: 15_000 });
  await b.screenshot({ path: "artifacts/tc-4-consent.png" });
  await b.getByRole("button", { name: /accept/i }).click();
  await expect(b.getByText(/sees your daily theme on their people page/i)).toBeVisible({
    timeout: 15_000,
  });
  await b.screenshot({ path: "artifacts/tc-4-accepted.png" });

  // --- Ari: Maya's personalized friend update ---
  await a.reload();
  await expect(a.getByText("FRIEND UPDATES", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(a.getByText("Maya").first()).toBeVisible();
  await expect(a.getByText("@maya-orion").first()).toBeVisible();
  const updateHeadline = (await a.locator("article .type-display").first().textContent())!.trim();
  expect(updateHeadline.length).toBeGreaterThan(0);
  // Her theme comes from HER chart: same sky, different person, different line.
  expect(updateHeadline).not.toBe(headline);

  // API shape: granted → exactly her update; never any raw birth fields.
  const fu = await a.request.get("/api/friend-updates");
  expect(fu.status()).toBe(200);
  const fuBody = await fu.json();
  expect(fuBody.data.updates).toHaveLength(1);
  expect(fuBody.data.updates[0].headline).toBe(updateHeadline);
  expect(fuBody.data.updates[0].displayName).toBe("Maya");
  expect(fuBody.data.updates[0].basis.precision).toBe("exact");
  expect(JSON.stringify(fuBody)).not.toMatch(
    /birth_date|birth_time|birth_lat|birth_lon|birth_time_zone/,
  );
  await a.screenshot({ path: "artifacts/tc-5-friend-update.png" });

  // --- Compatibility report (Ari's private notes person with birth details) ---
  const personRes = await a.request.post("/api/people", {
    data: {
      displayName: "Maya",
      relation: "friend",
      birthDate: "1992-03-08",
      birthTime: "14:45",
      birthTimePrecision: "exact",
      birthTimeZone: "America/Los_Angeles",
      birthLat: 34.0522,
      birthLon: -118.2437,
    },
  });
  expect(personRes.status()).toBe(201);
  const person = (await personRes.json()).data;
  await a.goto(`/people/${person.id}/report`);
  await expect(a.getByText("Communication").first()).toBeVisible({ timeout: 15_000 });
  expect(await a.getByLabel(/Tone \d of 5/).count()).toBeGreaterThanOrEqual(5);
  await a.screenshot({ path: "artifacts/tc-6-report.png" });

  // --- Partner chart while connected ---
  await a.goto("/people");
  await a.getByRole("link", { name: /view chart/i }).first().click();
  await a.waitForURL(`**/connections/${connId}/chart`, { timeout: 15_000 });
  await expect(a.getByText("Partner Chart")).toBeVisible({ timeout: 15_000 });
  await a.screenshot({ path: "artifacts/tc-7-partner-chart.png" });

  // --- Ari revokes the connection ---
  await a.goto("/people");
  await a.getByRole("button", { name: /disconnect/i }).first().click();
  await expect(a.getByText(/Connection ended/i)).toBeVisible({ timeout: 10_000 });
  await a.screenshot({ path: "artifacts/tc-8-revoked.png" });

  // --- Shared access gone immediately ---
  // Reload: the revoke updated the row in place, but the friend-updates
  // section refetches on mount — a stale client state must not count.
  await a.reload();
  await expect(a.getByText("FRIEND UPDATES", { exact: true })).toHaveCount(0);
  const fu2 = await a.request.get("/api/friend-updates");
  expect(((await fu2.json()) as { data: { updates: unknown[] } }).data.updates).toHaveLength(0);

  // Chart: fails closed — the disconnected state serves no placements.
  const chart = await a.request.get(`/api/connections/${connId}/chart`);
  expect(chart.status()).toBe(200);
  const chartBody = (await chart.json()) as {
    data: { state: string; placements?: unknown[] };
  };
  expect(chartBody.data.state).toBe("disconnected");
  expect(chartBody.data.placements).toBeUndefined();

  // Cross-user connection ids → 404, never a leak.
  const foreign = await a.request.get(
    "/api/connections/00000000-0000-0000-0000-000000000000/chart",
  );
  expect(foreign.status()).toBe(404);

  // Maya's side: same fail-closed projection; the ended row is audit-only.
  const chartB = await b.request.get(`/api/connections/${connId}/chart`);
  const chartBBody = (await chartB.json()) as {
    data: { state: string; placements?: unknown[] };
  };
  expect(chartBBody.data.placements).toBeUndefined();

  // Flush the session videos — Ari's covers the whole social loop.
  const videoA = a.video();
  await ctxA.close();
  if (videoA) {
    await videoA.saveAs("artifacts/tc-5-social-loop.webm");
  }
  await ctxB.close();
});
