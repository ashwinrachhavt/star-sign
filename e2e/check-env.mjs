import { chromium } from "@playwright/test";

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("response", async (res) => {
    if (res.url().includes("/v1/environment")) {
      try {
        const j = await res.json();
        const email = j.auth_config?.user_settings?.sign_up?.email_address
          ?? j.user_settings?.sign_up?.email_address
          ?? j.auth_config?.email_address;
        console.log("environment email_address config:", JSON.stringify(email).slice(0, 300));
        console.log(
          "sign_up block:",
          JSON.stringify(j.auth_config?.user_settings?.sign_up ?? "n/a").slice(0, 300),
        );
      } catch (e) {
        console.log("environment parse fail:", e.message);
      }
    }
  });
  await page.goto("http://localhost:3010/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
} finally {
  await browser.close();
}
