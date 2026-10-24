import { defineConfig } from "@playwright/test";

// Port 3010 (not 3000): the dev machine often runs other Next apps on
// 3000; a dedicated port guarantees the webServer below is OUR app.
const PORT = 3010;

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm --dir ../apps/web dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
