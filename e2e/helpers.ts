/** Shared e2e helpers: the new-run flow (carousel + difficulty) and a greedy player that
 *  drives a run through the board to the shop using the real UI (clicking cards + Play/Discard)
 *  while reading authoritative state from the API. */
import { expect, type Page } from "@playwright/test";

interface Card {
  id: string;
  rank: number;
  suit: string;
}

export async function authToken(page: Page): Promise<string> {
  return (await page.evaluate(() => localStorage.getItem("poker.token"))) ?? "";
}

/** Authoritative run state straight from the backend (the UI lags during score animations). */
export async function getRun(page: Page): Promise<any> {
  const token = await authToken(page);
  const res = await page.request.get("/api/run/active", {
    headers: { authorization: `Bearer ${token}` },
  });
  return (await res.json()).run;
}

// PET-206: create a fresh credentialed account each run. The invite link (?invite=) puts the
// auth screen into signup mode; the e2e stack runs the invite gate OFF (COLATRO_ALLOW_OPEN_SIGNUP),
// so the code value is accepted without a real admin claim.
export async function signIn(page: Page): Promise<string> {
  await page.goto("/?invite=e2e");
  const username = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
  await page.fill('input[id="name-input"]', username);
  await page.fill('input[id="password-input"]', "e2e-password-123");
  await page.click('button[data-action="signup"]');
  await expect(page.locator('button[data-action="goto-play"]')).toBeVisible({ timeout: 10000 });
  return username;
}

/** From the main menu: open the new-run screen, optionally cycle the deck carousel, pick a
 *  difficulty, and Start Run — landing on the blind-select screen. */
export async function startNewRun(
  page: Page,
  opts: { difficulty?: "easy" | "medium" | "hard"; deckNext?: number } = {},
): Promise<void> {
  const { difficulty = "easy", deckNext = 0 } = opts;
  await page.click('button[data-action="goto-play"]');
  await expect(page.locator('button[data-action="start-run"]')).toBeVisible({ timeout: 10000 });
  for (let i = 0; i < deckNext; i++) await page.click('button[data-action="deck-next"]');
  await page.click(`button[data-action="set-difficulty"][data-difficulty="${difficulty}"]`);
  await page.click('button[data-action="start-run"]');
  await expect(page.locator('button[data-action="start-blind"]')).toBeVisible({ timeout: 10000 });
}

function groupBy<T>(arr: T[], key: (t: T) => string | number): T[][] {
  const m = new Map<string | number, T[]>();
  for (const x of arr) {
    const k = key(x);
    const a = m.get(k) ?? [];
    a.push(x);
    m.set(k, a);
  }
  return [...m.values()];
}

/** Greedy picker: play any made hand (pair+ or a flush), else discard the low cards to dig. */
export function pickMove(
  hand: Card[],
  discardsRemaining: number,
): { action: "play" | "discard"; ids: string[] } {
  const rankGroups = groupBy(hand, (c) => c.rank).sort(
    (a, b) => b.length - a.length || b[0]!.rank - a[0]!.rank,
  );
  const made = rankGroups.filter((g) => g.length >= 2).flat();
  if (made.length >= 2) return { action: "play", ids: made.slice(0, 5).map((c) => c.id) };

  const flush = groupBy(hand, (c) => c.suit).find((g) => g.length >= 5);
  if (flush) return { action: "play", ids: flush.slice(0, 5).map((c) => c.id) };

  const asc = [...hand].sort((a, b) => a.rank - b.rank);
  if (discardsRemaining > 0) return { action: "discard", ids: asc.slice(0, 5).map((c) => c.id) };
  return { action: "play", ids: asc.slice(-5).map((c) => c.id) };
}

/** Play through the board in the real UI until the run reaches the shop or can no longer act. */
export async function driveToShop(page: Page, maxMoves = 14): Promise<any> {
  for (let i = 0; i < maxMoves; i++) {
    const run = await getRun(page);
    if (!run || run.status !== "playing") return run;
    const move = pickMove(run.hand, run.discardsRemaining);
    for (const id of move.ids) {
      await page.click(`button[data-action="toggle-card"][data-card-id="${id}"]`);
    }
    await page.click(`button[data-action="${move.action}"]`);
    // a play triggers the score animation (~2s); a discard re-renders quickly
    await page.waitForTimeout(move.action === "play" ? 2600 : 400);
  }
  return await getRun(page);
}
