import { chromium } from "@playwright/test";
import fs from "fs";

const BASE = "http://localhost:3010";
const OUT = "/tmp/journey";
fs.mkdirSync(OUT, { recursive: true });
const log = (m) => console.log(m);

// +clerk_test subaddress: with Test mode on, Clerk suppresses delivery and
// accepts the fixed code 424242 — the code-input step is fully exercisable.
const email = `buyer-${Date.now()}+clerk_test@starsign-test.dev`;
const password = `Sg${crypto.randomUUID().replace(/-/g, "").slice(0, 13)}!7`;
const TEST_CODE = "424242";

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  let signupStatus = null;
  page.on("response", async (res) => {
    if (res.url().includes("/v1/client/sign_ups") && res.request().method() === "POST") {
      try {
        const j = await res.json();
        signupStatus = j.response?.status ?? null;
        log(`FAPI sign_ups status: ${j.response?.status ?? JSON.stringify(j).slice(0, 150)}`);
        const ver = j.response?.verifications ?? {};
        for (const [k, v] of Object.entries(ver)) {
          log(`verification[${k}]: ${JSON.stringify(v).slice(0, 400)}`);
        }
        fs.writeFileSync(`${OUT}/signup-response.json`, JSON.stringify(j, null, 2));
      } catch {
        log(`FAPI sign_ups: HTTP ${res.status()}`);
      }
    }
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-login.png`, fullPage: true });

  // Switch to sign-up mode — the toggle is an <a href="#"> under "NEW HERE?"
  await page.locator('a[href="#"]').click();
  await page.waitForTimeout(300);

  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.screenshot({ path: `${OUT}/05-signup-filled.png`, fullPage: true });
  await page.getByRole("button", { name: /create account/i }).click();

  // Two legitimate outcomes, both acceptable (the instance's "Verify at
  // sign-up" toggle may be on or off at run time):
  //   - the email-code step renders (#code) — verification is required;
  //   - /onboarding loads — sign-up completed immediately, no code step.
  const onboarding = page
    .waitForURL("**/onboarding", { timeout: 45_000 })
    .then(() => "onboarding")
    .catch(() => null);
  const codeStep = page
    .locator("#code")
    .waitFor({ state: "visible", timeout: 45_000 })
    .then(() => "code")
    .catch(() => null);
  const landed = await Promise.race([onboarding, codeStep]);

  if (landed === "code") {
    log(`email-code step required (sign_ups status: ${signupStatus}) — entering test code`);
    await page.screenshot({ path: `${OUT}/06-code-step.png`, fullPage: true });
    await page.fill("#code", TEST_CODE);
    await page.getByRole("button", { name: /verify/i }).click();
    await page.waitForURL("**/onboarding", { timeout: 45_000 }).catch(() => {});
    const verr = await page.locator(".form-error").textContent().catch(() => null);
    if (verr) log(`FORM MESSAGE (verify): ${verr.trim()}`);
  } else if (landed === "onboarding") {
    log(`no verification required — sign-up completed immediately (${signupStatus})`);
  }
  if (!page.url().includes("/onboarding")) {
    await page.screenshot({ path: `${OUT}/05b-signup-failed.png`, fullPage: true });
    throw new Error(`sign-up did not complete; still on ${page.url()}`);
  }
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/07-onboarding-live.png`, fullPage: true });
  log(`sign-up COMPLETE — buyer landed on: ${page.url()}`);

  const cookies = await ctx.cookies();
  const sessionCookie = cookies.find((c) => c.name === "__session");
  if (!sessionCookie) throw new Error("no __session cookie after sign-up");
  const claims = JSON.parse(
    Buffer.from(sessionCookie.value.split(".")[1], "base64").toString("utf8"),
  );
  const safe = {
    sub: claims.sub,
    iss: claims.iss,
    aud: claims.aud,
    sid: claims.sid,
    iat: claims.iat,
    exp: claims.exp,
    exp_in_hours: Math.round(((claims.exp - claims.iat) / 3600) * 10) / 10,
  };
  log(`buyer JWT sub: ${safe.sub}`);
  log(`buyer JWT iss: ${safe.iss}`);
  log(`buyer JWT aud: ${JSON.stringify(safe.aud)} | validity ${safe.exp_in_hours}h`);

  // Sign-in leg in a fresh context (no inherited session): the same
  // credentials must sign in and land on /day.
  const sctx = await browser.newContext();
  const spage = await sctx.newPage();
  await spage.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await spage.fill("#email", email);
  await spage.fill("#password", password);
  await spage.getByRole("button", { name: /sign in/i }).click();
  await spage.waitForURL("**/day", { timeout: 45_000 }).catch(() => {});
  const serr = await spage.locator(".form-error").textContent().catch(() => null);
  if (serr) log(`FORM MESSAGE (sign-in): ${serr.trim()}`);
  if (!spage.url().includes("/day")) {
    await spage.screenshot({ path: `${OUT}/08-signin-failed.png`, fullPage: true });
    throw new Error(`sign-in did not complete; still on ${spage.url()}`);
  }
  await spage.waitForLoadState("networkidle");
  await spage.screenshot({ path: `${OUT}/09-day-live.png`, fullPage: true });
  log(`sign-in COMPLETE — landed on: ${spage.url()}`);
  await sctx.close();

  fs.writeFileSync(
    `${OUT}/buyer-journey.json`,
    JSON.stringify({ email, verificationPath: landed, signupStatus, ...safe }, null, 2),
  );
  fs.writeFileSync(
    `${OUT}/summary-buyer.json`,
    JSON.stringify(
      {
        buyer_signup: "complete",
        verification_path: landed,
        signup_status: signupStatus,
        buyer_signin: "complete",
        jwt_sub: safe.sub,
        landed: page.url(),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
