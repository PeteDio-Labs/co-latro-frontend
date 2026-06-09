/** End-to-end smoke for Co-latro — the full happy path through the NEW new-run UI.
 *  Sign in → New Run (carousel + Easy) → play greedily → win the blind → reach the shop.
 *
 *  Runs against the docker-compose stack at http://localhost:8080:  bun run e2e
 *  Override with E2E_BASE_URL=... for another deployment. */
import { test, expect } from "@playwright/test";
import { signIn, startNewRun, driveToShop } from "./helpers";

test("sign-in → new run → win the blind → shop", { timeout: 90_000 }, async ({ page }) => {
  await signIn(page);
  await startNewRun(page, { difficulty: "easy" });

  // blind-select → play the small blind
  await page.click('button[data-action="start-blind"]');
  await expect(page.locator('button[data-action="toggle-card"]').first()).toBeVisible({
    timeout: 10000,
  });

  // greedily clear the blind (Easy target is low + 5 hands / 4 discards)
  const run = await driveToShop(page);
  expect(run?.status).toBe("shop");

  // shop UI is up: the cash-out Continue button is the stable shop selector
  await expect(page.locator('button[data-action="continue"]')).toBeVisible({ timeout: 10000 });
});
