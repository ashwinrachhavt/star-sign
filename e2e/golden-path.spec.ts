/**
 * Golden-path smoke (ASH-235 / 0.5b): sign up → onboarding → day page.
 * Runs against local Supabase (`supabase start`) and the Next dev server.
 */
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://localhost:54321";
// The local Supabase stack's anon key is stable and public (printed by
// `supabase start`); CI reuses it. An empty-string env var (unset secret)
// must not override the fallback.
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const email = `smoke-${Date.now()}@example.com`;
const password = "smoke-password-123";

test("golden path: signup → onboarding → day page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: false }).fill(password);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByRole("button", { name: /create account/i }).click();

  // Sign-up lands on onboarding.
  await page.waitForURL("**/onboarding", { timeout: 15_000 });

  await page.getByLabel("Birth date").fill("1990-06-15");
  // Default precision is "exact" → a time is required.
  await page.getByLabel("Time", { exact: true }).fill("09:30");
  await page.getByLabel("Time zone at birth").fill("America/New_York");
  await page.getByLabel("Latitude").fill("40.7128");
  await page.getByLabel("Longitude").fill("-74.006");
  await page.getByRole("button", { name: /continue/i }).click();

  // Day page renders the reading ritual: the headline h1 carries the
  // generated text, so assert on stable anchors — the date line and the
  // Dos section.
  await page.waitForURL("**/day", { timeout: 15_000 });
  await expect(page.locator("h1.headline")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Dos")).toBeVisible();

  // The reading exists in the database (idempotent creation ran).
  const admin = createClient(SUPABASE_URL, ANON_KEY);
  const { data: auth } = await admin.auth.signInWithPassword({ email, password });
  expect(auth.user).toBeTruthy();

  const { data: reading, error } = await admin
    .from("daily_readings")
    .select("id, headline")
    .eq("user_id", auth.user!.id)
    .maybeSingle();
  expect(error).toBeNull();
  expect(reading?.headline).toBeTruthy();
});
