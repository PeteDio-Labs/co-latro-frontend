/** Playwright config for the Co-latro E2E smoke (PET-66).
 *  Target stack must be reachable at E2E_BASE_URL (default http://localhost:8080) — the
 *  docker compose stack (backend + nginx serving dist/) is the canonical local target.
 *  PET-98: the ci.yml `e2e` job stands that stack up in-job and gates PRs. */
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    actionTimeout: 10000,
    trace: "retain-on-failure",
  },
  reporter: process.env.CI ? "list" : "list",
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
