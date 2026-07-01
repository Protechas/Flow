import { defineConfig, devices } from "@playwright/test";

const E2E_PORT = process.env.PW_PORT ?? "3001";
const E2E_BASE = `http://127.0.0.1:${E2E_PORT}`;
const demoEnv = {
  NEXT_PUBLIC_FLOW_DEMO_MODE: "true",
  NEXT_PUBLIC_SITE_URL: E2E_BASE,
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
};
const useStart = Boolean(process.env.CI || process.env.PW_USE_START);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: E2E_BASE,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: useStart
      ? `npx next start --hostname 127.0.0.1 --port ${E2E_PORT}`
      : `npx next dev --hostname 127.0.0.1 --port ${E2E_PORT}`,
    url: `${E2E_BASE}/login`,
    reuseExistingServer: !useStart && process.env.PW_REUSE_SERVER === "true",
    timeout: 120_000,
    env: demoEnv,
  },
});
