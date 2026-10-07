import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run the real backend (embedded, ephemeral MongoDB with sample data, DEMO_MODE so
// nothing is scraped) and a production build of the frontend. Uses the installed Microsoft Edge.
const FRONT = 3100;
const BACK = 5100;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${FRONT}`,
    channel: "msedge",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", testIgnore: /(responsive|screens-mobile)[.]spec/, use: { ...devices["Desktop Chrome"], channel: "msedge", viewport: { width: 1440, height: 900 } } },
    { name: "mobile", testMatch: /(responsive|screens-mobile)[.]spec/, use: { ...devices["Pixel 7"], channel: "msedge" } },
  ],
  webServer: [
    {
      command: "node ../backend/src/server.js",
      url: `http://127.0.0.1:${BACK}/api/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        PORT: String(BACK),
        NODE_ENV: "development",
        MONGO_URI: "memory:ephemeral",
        SEED_SOURCE: "sample", // tests rely on the fixed-shape sample catalog, not the real captured listings
        JWT_SECRET: "e2e-secret-not-for-production",
        // E2E_LIVE=1 (report screenshots): real store searches, no demo banner
        DEMO_MODE: process.env.E2E_LIVE ? "false" : "true",
        JOBS_ENABLED: "false",
        JOB_KEY: "e2e-key",
        AUTH_RATE_LIMIT_MAX: "1000",
        API_RATE_LIMIT_MAX: "10000",
        SEARCH_RATE_LIMIT_MAX: "10000",
        CORS_ORIGIN: `http://localhost:${FRONT}`,
      },
    },
    {
      command: `npx next build && npx next start -p ${FRONT}`,
      url: `http://localhost:${FRONT}`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: { BACKEND_URL: `http://127.0.0.1:${BACK}`, NEXT_DIST_DIR: ".next-e2e" },
    },
  ],
});
