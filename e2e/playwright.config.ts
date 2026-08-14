/** Playwright config for the Co-latro E2E smoke (PET-66).
 *  Target stack must be reachable at E2E_BASE_URL (default http://localhost:8080) — the
 *  docker compose stack (backend + nginx serving dist/) is the canonical local target.
 *  PET-98: the ci.yml `e2e` job stands that stack up in-job and gates PRs. */
import { defineConfig } from "@playwright/test";

// CI is the single self-hosted homelab runner (see ci.yml) — one box, shared with the rest of
// the homelab, so a run can land while the host is busy and execute ~2x slower than an idle
// one. Measured: the first test took 6.8s on an idle box, 8.8s on a moderately busy one, and
// 14.4s on a loaded one — against what used to be a flat 10s assertion budget, i.e. it went
// red on load. The budgets below are deliberately generous in CI: these are smoke assertions,
// not latency SLOs. A *slow* box must not red a PR; a *broken* app still fails — it just takes
// longer to say so, and it fails every retry.
//
// This config is the single source of truth for those budgets. Don't re-introduce per-call
// `{ timeout: … }` overrides in the specs/helpers — they silently bypass everything here,
// which is precisely how the 10s deadline survived a runner that got twice as slow.
const CI = !!process.env.CI;

export default defineConfig({
  testDir: ".",
  timeout: CI ? 60_000 : 30_000,
  expect: { timeout: CI ? 20_000 : 10_000 },
  // A timing loss on a contended box is not a regression. Retry it in CI; a real break fails
  // all three attempts. Locally, fail fast — an idle dev machine has no excuse.
  retries: CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:8080",
    actionTimeout: CI ? 20_000 : 10_000,
    trace: "retain-on-failure",
  },
  reporter: "list",
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
