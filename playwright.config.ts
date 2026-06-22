import { defineConfig, devices } from "@playwright/test";

/**
 * Tests E2E ciblés sur le CHEMIN DE L'ARGENT (checkout, redirection MonCash,
 * pages de résultat). Tournent en mode démo (sans Supabase ni MonCash réels) :
 * les appels backend sont interceptés par Playwright. Pas de couverture UI
 * exhaustive — uniquement ce qui te coûterait cher si ça cassait.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
