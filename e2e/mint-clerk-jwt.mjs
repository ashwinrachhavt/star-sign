#!/usr/bin/env node
// Mint real Clerk session JWTs for two test users via the Clerk sign-in
// TICKET flow: the Backend API returns a one-time ticket URL on the hosted
// accounts.dev sign-in page; a headless browser consumes it (real clerk-js,
// real dev-instance handshake — same mechanics as the app's /login), then
// the session JWT is read from the FAPI client in the same context.
//
// Reference: e2e/live-token-session.mjs (sign-in-token session on live-verify).
//
// Usage: node mint-clerk-jwt.mjs
// Env:   SECRET_CLERK_SECRET_KEY
// Out:   /tmp/journey/jwt-owner.json, /tmp/journey/jwt-other.json
import { chromium } from "@playwright/test";
import fs from "fs";

const CLERK_SECRET = process.env.SECRET_CLERK_SECRET_KEY;
const PK = process.env.SECRET_NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const OUT = "/tmp/journey";
fs.mkdirSync(OUT, { recursive: true });
const log = (m) => console.log(m);

if (!CLERK_SECRET) throw new Error("missing SECRET_CLERK_SECRET_KEY");

// Users created this session via the Backend API.
const USERS = {
  owner: { id: "user_3LgQnNaYtqGMaYQ8wL6A3zhOfFw", email: "rls-owner@starsign-test.dev" },
  other: { id: "user_3LgQnQDNaUEvlOhbDNpUHHvN2sp", email: "rls-other@starsign-test.dev" },
};

async function clerkApi(path, body) {
  const res = await fetch(`https://api.clerk.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${CLERK_SECRET}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body ?? {}),
  });
  const j = await res.json();
  if (j.errors) throw new Error(`${path}: ${JSON.stringify(j.errors).slice(0, 300)}`);
  return j;
}

const decodeJwt = (jwt) => JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));

const browser = await chromium.launch();
try {
  for (const [role, user] of Object.entries(USERS)) {
    log(`\n===== ${role} (${user.id}) =====`);
    const token = await clerkApi("sign_in_tokens", { user_id: user.id });
    log(`ticket url: ${token.url.slice(0, 60)}...`);

    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // Consume the ticket on the hosted sign-in page (real clerk-js runs here).
    await page.goto(token.url, { waitUntil: "domcontentloaded", timeout: 45_000 });

    // Poll until the session exists. On the portal page the authoritative
    // source is the page's own clerk-js instance; fall back to a same-origin
    // client fetch. Diagnose non-2xx fetches instead of discarding them.
    let jwt = null;
    let sid = null;
    let lastDiag = "";
    for (let i = 0; i < 60 && !jwt; i++) {
      await page.waitForTimeout(500);
      const snap = await page.evaluate(async () => {
        try {
          // (a) clerk-js on this page (present on hosted portal pages).
          if (window.Clerk?.session) {
            const tok = await window.Clerk.session.getToken();
            if (tok) return { via: "clerk.session", jwt: tok, sid: window.Clerk.session.id };
          }
          // (b) same-origin client fetch.
          const r = await fetch("/v1/client", { credentials: "include" });
          if (!r.ok) return { via: "fetch", http: r.status, body: (await r.text()).slice(0, 150) };
          const j = await r.json();
          const s = j.response?.sessions?.[0];
          if (s) return { via: "fetch", sid: s.id, jwt: s.last_active_token?.jwt ?? null };
          return { via: "fetch", sessions: 0 };
        } catch (e) {
          return { via: "error", err: String(e).slice(0, 120) };
        }
      });
      lastDiag = JSON.stringify(snap).slice(0, 160);
      if (snap?.jwt) {
        jwt = snap.jwt;
        sid = snap.sid ?? sid;
      } else if (snap?.sid) {
        sid = snap.sid;
      }
    }
    if (!jwt) {
      // Last resort: inject clerk-js on the redirect page and read the client.
      log(`polling exhausted; last diag: ${lastDiag} | page: ${page.url()}`);
      jwt = await page.evaluate(async (pk) => {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://included-mole-1154.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js";
          s.setAttribute("data-clerk-publishable-key", pk);
          s.async = true;
          s.onload = resolve;
          s.onerror = () => reject(new Error("clerk-js load failed"));
          document.head.appendChild(s);
        });
        await window.Clerk.load();
        return await window.Clerk.session?.getToken?.() ?? null;
      }, PK).catch(() => null);
      sid = sid ?? "unknown";
    }
    if (!jwt) {
      fs.writeFileSync(`${OUT}/ticket-fail-${role}.json`, JSON.stringify({ url: token.url, page_url: page.url() }, null, 2));
      await page.screenshot({ path: `${OUT}/ticket-fail-${role}.png`, fullPage: true });
      throw new Error(`session/JWT never appeared for ${role} (landed on ${page.url()})`);
    }

    const claims = decodeJwt(jwt);
    const record = {
      role,
      clerk_user_id: user.id,
      email_hint: user.email,
      session_id: sid,
      jwt,
      claims: { sub: claims.sub, iss: claims.iss, azp: claims.azp, sid: claims.sid, iat: claims.iat, exp: claims.exp },
      minted_at: new Date().toISOString(),
    };
    fs.writeFileSync(`${OUT}/jwt-${role}.json`, JSON.stringify(record, null, 2));
    log(`JWT minted → ${OUT}/jwt-${role}.json`);
    log(`  sub: ${claims.sub}`);
    log(`  iss: ${claims.iss}`);
    log(`  azp: ${claims.azp ?? "(none)"}`);
    log(`  validity: ${Math.round(((claims.exp - claims.iat) / 36) / 100)}h`);
    await ctx.close();
  }
  log("\nMINT COMPLETE");
} finally {
  await browser.close();
}
