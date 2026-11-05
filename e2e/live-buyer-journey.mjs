import { chromium } from "@playwright/test";
import fs from "fs";

const BASE = "http://localhost:3010";
const OUT = "/tmp/journey";
fs.mkdirSync(OUT, { recursive: true });
const log = (m) => console.log(m);

const email = `buyer-${Date.now()}@starsign-test.dev`;
const password = `Sg${crypto.randomUUID().replace(/-/g, "").slice(0, 13)}!7`;

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on("response", async (res) => {
    if (res.url().includes("/v1/client/sign_ups") && res.request().method() === "POST") {
      try {
        const j = await res.json();
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

  // Complete sign-up pushes /onboarding
  await page.waitForURL("**/onboarding", { timeout: 45_000 }).catch(() => {});
  const err = await page.locator(".form-error").textContent().catch(() => null);
  if (err) log(`FORM MESSAGE: ${err.trim()}`);
  if (!page.url().includes("/onboarding")) {
    await page.screenshot({ path: `${OUT}/05b-signup-failed.png`, fullPage: true });
    throw new Error(`sign-up did not complete; still on ${page.url()}`);
  }
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/06-onboarding-live.png`, fullPage: true });
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
  fs.writeFileSync(
    `${OUT}/buyer-journey.json`,
    JSON.stringify({ email, ...safe }, null, 2),
  );
  log(`buyer JWT sub: ${safe.sub}`);
  log(`buyer JWT iss: ${safe.iss}`);
  log(`buyer JWT aud: ${JSON.stringify(safe.aud)} | validity ${safe.exp_in_hours}h`);

  fs.writeFileSync(
    `${OUT}/summary-buyer.json`,
    JSON.stringify(
      { buyer_signup: "complete", jwt_sub: safe.sub, landed: page.url() },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
