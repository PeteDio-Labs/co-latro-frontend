/** End-to-end smoke for Co-latro (PET-66).
 *  Sign in → start a run → play a hand → reach a terminal state (shop or game-over).
 *
 *  The smoke proves the full integrated path runs end-to-end against a real backend +
 *  static-served dist. Random-card play on Easy doesn't reliably clear the small blind,
 *  so we accept either outcome — reaching shop (Continue) or running out of hands
 *  (GAME OVER) — as a pass. Either way the play+score+resolution pipeline ran.
 *
 *  Run locally against the docker-compose stack served at http://localhost:8080:
 *      bun run e2e
 *  Override the target with E2E_BASE_URL=... for any other deployment.
 *
 *  CI gating is deferred until a job can stand the backend + nginx up in-workflow
 *  (see PR description for follow-up). */
import { test, expect } from "@playwright/test";

test("sign-in → start run → play a hand → reach terminal state", async ({ page }) => {
  await page.goto("/");

  // ---- sign in with a fresh callsign every time so we never hit "active run" ----
  const callsign = `e2e-${Date.now()}`;
  await page.fill('input[id="name-input"]', callsign);
  await page.click('button[data-action="signin"]');

  // ---- main menu → play ----
  await page.click('button[data-action="goto-play"]');

  // ---- pick a deck (defaults to standard if only one is shown) ----
  const decks = page.locator('button[data-action="choose-deck"]');
  await expect(decks.first()).toBeVisible({ timeout: 10000 });
  await decks.first().click();

  // ---- pick a difficulty (use easy when offered) ----
  const easy = page.locator('button[data-action="choose-difficulty"][data-difficulty="easy"]');
  if (await easy.count() > 0) {
    await easy.click();
  } else {
    await page.locator('button[data-action="choose-difficulty"]').first().click();
  }

  // ---- blind select → play the small blind ----
  await expect(page.locator('button[data-action="start-blind"]')).toBeVisible({ timeout: 10000 });
  await page.click('button[data-action="start-blind"]');

  // ---- on the board: play hands until we cross into the shop ----
  // We don't try to engineer a winning hand — instead loop the available play actions
  // until either the Continue button (shop) appears or the run is exhausted. On easy this
  // typically clears in 1-3 plays; the smoke just needs to prove the integrated path works.
  const cards = page.locator('button[data-action="toggle-card"]');
  await expect(cards.first()).toBeVisible({ timeout: 10000 });

  const continueBtn = page.locator('button[data-action="continue"]');
  // run-end overlay exposes a "new-run" button (renderRunOverlay) — a stable selector
  // that doesn't depend on exact title text. Either state proves the play pipeline ran.
  const newRunBtn = page.locator('button[data-action="new-run"]');

  for (let attempt = 0; attempt < 6; attempt++) {
    if (await continueBtn.count() > 0 || await newRunBtn.count() > 0) break;
    // Pick a fresh selection each iteration (re-render after every play resets the hand).
    const visibleCards = await cards.count();
    if (visibleCards === 0) break;
    const toClick = Math.min(visibleCards, 5);
    for (let i = 0; i < toClick; i++) await cards.nth(i).click();
    const playBtn = page.locator('button[data-action="play"]');
    if (!(await playBtn.isEnabled().catch(() => false))) break;
    await playBtn.click();
    // wait for the score animation to settle (≈1.5–2.5s) then re-evaluate
    await page.waitForTimeout(2500);
  }

  // Pass if EITHER the shop's Continue is up OR the run-end overlay's New Run is up —
  // the integrated sign-in → play pipeline ran end-to-end either way.
  const terminal = page.locator(
    'button[data-action="continue"], button[data-action="new-run"]',
  );
  await expect(terminal.first()).toBeVisible({ timeout: 15000 });
});
