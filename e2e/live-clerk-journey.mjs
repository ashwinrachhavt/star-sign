import { chromium } from "@playwright/test";
import fs from "fs";

// Credentials: written by the orchestrator, never logged.
const env = Object.fromEntries(
  fs.readFileSync("/tmp/clerk-test-users.env", "utf8").trim().split("\n").map((l) => l.split("=")),
);
const A = { email: env.A_EMAIL, pass: env.A_PASS };

const BASE = "http://localhost:3010";
const OUT = "/tmp/journey";
fs.mkdirSync(OUT, { recursive: true });
const log = (m) => console.log(m);

const browser = await chromium.launch();
try {
  // --- Leg 1: real Clerk password sign-in as user A ---
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-login.png`, fullPage: true });

  const emailVal = await page.locator("#email").count();
  log(`login form email input present: ${emailVal === 1}`);
  if (emailVal !== 1) throw new Error("Clerk login form did not render");

  await page.fill("#email", A.email);
  await page.fill("#password", A.pass);
  page.on("console", (msg) => {
    if (msg.type() === "error") log(`console: ${msg.text().slice(0, 200)}`);
  });
  page.on("response", (res) => {
    if (res.url().includes("clerk") && res.status() >= 400)
      log(`clerk ${res.status()}: ${res.url().slice(0, 120)}`);
  });
  await page.getByRole("button", { name: "Sign in" }).click();

  // signIn.create resolves to status complete on a real handshake; the form
  // then pushes /day. Wait for the protected route to render.
  await page.waitForURL("**/day", { timeout: 45_000 }).catch(() => {});
  const errText = await page.locator(".form-error").textContent().catch(() => null);
  if (errText) log(`FORM ERROR: ${errText.trim()}`);
  if (!page.url().includes("/day")) {
    await page.screenshot({ path: `${OUT}/02b-signin-failed.png`, fullPage: true });
    throw new Error(`sign-in did not complete; still on ${page.url()}`);
  }
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `${OUT}/02-day-authenticated.png`, fullPage: true });
  log(`reached /day authenticated: ${page.url()}`);

  // --- Session JWT: the token RLS v3 will receive as auth.jwt()->>'sub' ---
  const cookies = await ctx.cookies();
  const sessionCookie = cookies.find((c) => c.name === "__session");
  if (!sessionCookie) throw new Error("no __session cookie after sign-in");
  const payloadB64 = sessionCookie.value.split(".")[1];
  const claims = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
  const safe = {
    sub: claims.sub,
    iss: claims.iss,
    aud: claims.aud,
    sid: claims.sid,
    iat: claims.iat,
    exp: claims.exp,
    exp_in_hours: Math.round(((claims.exp - claims.iat) / 3600) * 10) / 10,
  };
  fs.writeFileSync(`${OUT}/jwt-claims.json`, JSON.stringify(safe, null, 2));
  log(`JWT sub: ${safe.sub}`);
  log(`JWT iss: ${safe.iss}`);
  log(`JWT aud: ${JSON.stringify(safe.aud)}`);
  log(`JWT validity: ${safe.exp_in_hours}h`);

  await ctx.close();

  // --- Leg 2: logged-out user cannot reach a protected route ---
  const anon = await browser.newContext();
  const p2 = await anon.newPage();
  await p2.goto(`${BASE}/day`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(2500);
  const url = p2.url();
  await p2.screenshot({ path: `${OUT}/03-loggedout-redirect.png`, fullPage: true });
  log(`logged-out /day landed on: ${url} (expect ${BASE}/login)`);
  await anon.close();

  fs.writeFileSync(
    `${OUT}/summary.json`,
    JSON.stringify(
      {
        clerk_signin: "complete",
        jwt_sub: safe.sub,
        jwt_iss: safe.iss,
        protected_route_authed: page.url().includes("/day"),
        logged_out_redirect: url.endsWith("/login"),
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
