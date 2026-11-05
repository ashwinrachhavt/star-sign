import { chromium } from "@playwright/test";
import fs from "fs";
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("response", async (res) => {
    if (res.url().includes("/v1/environment")) {
      try { fs.writeFileSync("/tmp/journey/environment.json", JSON.stringify(await res.json(), null, 2)); console.log("environment captured"); } catch {}
    }
  });
  await page.goto("http://localhost:3010/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
} finally { await browser.close(); }
