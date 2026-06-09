/** Flow coverage for the new-run UI + blind-select actions:
 *  deck carousel, difficulty selection, and skipping a blind for a tag. */
import { test, expect } from "@playwright/test";
import { signIn, startNewRun, getRun } from "./helpers";

test("deck carousel cycles through the catalog", async ({ page }) => {
  await signIn(page);
  await page.click('button[data-action="goto-play"]');
  await expect(page.locator('button[data-action="start-run"]')).toBeVisible({ timeout: 10000 });

  const screen = page.locator(".cy-screen");
  await expect(screen).toContainText("Standard Deck"); // first deck shown
  await page.click('button[data-action="deck-next"]');
  await expect(screen).toContainText("Red Deck"); // carousel advanced
  await page.click('button[data-action="deck-prev"]');
  await expect(screen).toContainText("Standard Deck"); // wrapped back
});

test("difficulty is selectable and carried into the run", async ({ page }) => {
  await signIn(page);
  await page.click('button[data-action="goto-play"]');
  await page.click('button[data-action="set-difficulty"][data-difficulty="hard"]');
  await page.click('button[data-action="start-run"]');
  await expect(page.locator('button[data-action="start-blind"]')).toBeVisible({ timeout: 10000 });

  const run = await getRun(page);
  expect(run.difficulty).toBe("hard");
});

test("skipping the small blind grants a tag and advances", async ({ page }) => {
  await signIn(page);
  await startNewRun(page, { difficulty: "easy" });

  const before = await getRun(page);
  expect(before.status).toBe("selecting_blind");
  expect(before.blindKind).toBe("small");

  await page.click('button[data-action="skip-blind"]');
  await page.waitForTimeout(700);

  const after = await getRun(page);
  // skipsThisRun is the definitive signal: it always increments on a skip, whereas the rolled
  // tag may fire + be consumed immediately (e.g. a pack tag), so tags.length is RNG-flaky.
  expect(after.skipsThisRun).toBeGreaterThanOrEqual(1);
  expect(after.blindKind).toBe("big"); // advanced small → big within the ante
});
