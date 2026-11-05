import { chromium } from "@playwright/test";
import fs from "fs";

const BASE = "http://localhost:3010";
const OUT = "/tmp/journey";
fs.mkdirSync(OUT, { recursive: true });
const log = (m) => console.log(m);

const token = fs.readFileSync(`${OUT}/signin-token.txt`, "utf8").trim();

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Step 1: initialize clerk-js so the dev-instance handshake runs. Capture
  // the FAPI origin and __clerk_db_jwt from real requests (never parsed from
  // the publishable key — that encoding is not the host).
  let FAPI = null;
  let dbJwt = null;
  page.on("request", (req) => {
    if (!req.url().includes("clerk.accounts.dev")) return;
    if (!FAPI) FAPI = new URL(req.url()).origin;
    const u = new URL(req.url());
    const v = u.searchParams.get("__clerk_db_jwt");
    if (v && !dbJwt) {
      dbJwt = v;
      log(`captured __clerk_db_jwt from ${u.pathname}`);
    }
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  for (let i = 0; i < 20 && !(dbJwt && FAPI); i++) await page.waitForTimeout(500);
  if (!dbJwt || !FAPI) throw new Error("never captured FAPI host / __clerk_db_jwt");
  log(`FAPI: ${FAPI}`);

  // Step 2: consume the sign-in token on the FAPI host (sets the client +
  // session cookies in the browser's FAPI cookie jar).
  const resp = await page.goto(
    `${FAPI}/v1/client?_method=POST&token=${encodeURIComponent(token)}&__clerk_db_jwt=${encodeURIComponent(dbJwt)}`,
    { waitUntil: "domcontentloaded" },
  );
  log(`token consumption: HTTP ${resp.status()}`);
  {
    const body = await page.content();
    const m = body.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const client = JSON.parse(m[0]);
        const sessions = client.response?.sessions ?? [];
        log(
          `client sessions: ${sessions.length}${sessions.length ? ` statuses=${sessions.map((s) => s.status).join(",")}` : ""}`,
        );
        log(`client status: ${client.response?.status}`);
      } catch {
        log(`client body unparseable (first 200): ${body.slice(0, 200)}`);
      }
    } else {
      log(`client body (first 200): ${body.slice(0, 200)}`);
    }
  }
  const jarAfter2 = await ctx.cookies();
  log(`cookies after step 2: ${jarAfter2.map((c) => `${c.name}@${c.domain}`).join(", ")}`);
  if (resp.status() !== 200) {
    const body = await page.content();
    log(`response body (first 300): ${body.slice(0, 300)}`);
    throw new Error(`token consumption failed with HTTP ${resp.status()}`);
  }

  // Step 3: back to the app. clerk-js hydrates on the app domain, sees the
  // session from the FAPI client, and mints the app-domain __session cookie.
  // Poll for it on /login (middleware bounces /day until the cookie exists),
  // then navigate to /day.
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  let session = null;
  for (let i = 0; i < 60 && !session; i++) {
    await page.waitForTimeout(500);
    session = (await ctx.cookies()).find((c) => c.name === "__session");
    if (i === 5) {
      const jarMid = await ctx.cookies();
      log(`cookies mid-poll: ${jarMid.map((c) => `${c.name}@${c.domain}`).join(", ")}`);
    }
  }
  if (!session) throw new Error("clerk-js never minted an app-domain __session cookie");
  log("app-domain __session cookie present");

  await page.goto(`${BASE}/day`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/04-day-token-session.png`, fullPage: true });
  log(`landed on: ${page.url()}`);

  const cookies = await ctx.cookies();
  const sessionCookie = cookies.find((c) => c.name === "__session");
  if (!sessionCookie) throw new Error("no __session cookie after token sign-in");
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
  fs.writeFileSync(`${OUT}/jwt-claims.json`, JSON.stringify(safe, null, 2));
  log(`JWT sub: ${safe.sub}`);
  log(`JWT iss: ${safe.iss}`);
  log(`JWT aud: ${JSON.stringify(safe.aud)} | validity ${safe.exp_in_hours}h`);

  fs.writeFileSync(
    `${OUT}/summary-token-session.json`,
    JSON.stringify(
      { token_session: "complete", jwt_sub: safe.sub, jwt_iss: safe.iss, day_url: page.url() },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
