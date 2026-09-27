import { defineConfig } from "@playwright/test";

/**
 * End-to-end test of the guest flow against a production build.
 * The server runs with DATABASE_URL and Auth0 blanked out (real env vars beat
 * .env.local), so it uses the seed program data and everyone is a guest. Gemini
 * is replaced per-test with a fixed extraction; the rules engine runs for real.
 * Uses the installed Google Chrome, so no browser download is needed.
 */
const PORT = 3200;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: "",
      AUTH0_DOMAIN: "",
      AUTH0_CLIENT_ID: "",
      AUTH0_CLIENT_SECRET: "",
      AUTH0_SECRET: "",
      GEMINI_API_KEY: "",
      ELEVENLABS_API_KEY: "",
    },
  },
});
