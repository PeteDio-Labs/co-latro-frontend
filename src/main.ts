/** App entry: client state + screen router, deck-select flow, score animation, shop, deck peek. */

import "./styles.css";
import * as api from "./api.ts";
import { setManualRetryHandler, subscribeNet, type NetStatus } from "./net.ts";
import { registerServiceWorker } from "./sw-register.ts";
import { showToast } from "./toast.ts";
import {
  renderBlindSelect,
  renderBoard,
  renderConfirmDialog,
  renderDeckPeek,
  renderDetailFor,
  renderMainMenu,
  renderNewRunSelect,
  renderOptions,
  renderPackOpen,
  renderPlayResolution,
  renderRunOverlay,
  renderSettings,
  renderShop,
  renderSignIn,
  type AnimState,
} from "./ui.ts";
import type {
  Card,
  Consumable,
  DeckPeekDTO,
  DeckSummary,
  Difficulty,
  Rank,
  RunStateDTO,
  ScoreBreakdown,
  User,
} from "./types.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
const TOKEN_KEY = "poker.token";

type MenuView = "menu" | "settings" | "options" | "newrun";

interface ClientState {
  token: string | null;
  user: User | null;
  run: RunStateDTO | null;
  selected: Set<string>;
  preview: ScoreBreakdown | null;
  menuView: MenuView | null;
  decks: DeckSummary[];
  selectedDeckId: string;
  selectedDifficulty: Difficulty;
  deckPeek: DeckPeekDTO | null;
  anim: AnimState | null;
  pendingNewRun: { difficulty: Difficulty } | null;
  detailId: string | null;
  /** A consumable whose `needsSelection` requires the player to pick N cards first.
   *  While set, the board enters "selection mode": existing toggle-card flow populates
   *  `selected`; Confirm fires useConsumable, Cancel clears this. (PET-71) */
  pendingConsumable: { instanceId: string; def: Consumable } | null;
  /** PET-70: ids picked inside the booster-pack opener. Cleared on every status change. */
  packPicks: Set<string>;
}

const state: ClientState = {
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  run: null,
  selected: new Set(),
  preview: null,
  menuView: null,
  decks: [],
  selectedDeckId: "standard",
  selectedDifficulty: "easy",
  deckPeek: null,
  anim: null,
  pendingNewRun: null,
  detailId: null,
  pendingConsumable: null,
  packPicks: new Set(),
};

function cardChipValue(rank: Rank): number {
  if (rank === 14) return 11;
  if (rank >= 11) return 10;
  return rank;
}

function hasActiveRun(): boolean {
  return !!state.run && state.run.status !== "won_run" && state.run.status !== "lost_run";
}

function screenHtml(dealIds: Set<string>): string {
  if (state.anim) return renderPlayResolution(state.anim);
  if (!state.user) return renderSignIn();
  if (state.menuView === "menu") return renderMainMenu(state.user, hasActiveRun() ? state.run : null);
  if (state.menuView === "settings") return renderSettings(state.user);
  if (state.menuView === "options") return renderOptions();
  if (state.menuView === "newrun") return renderNewRunSelect(state.decks, state.selectedDeckId, state.selectedDifficulty);

  const run = state.run;
  if (!run) return renderMainMenu(state.user, null);
  if (run.status === "playing") return renderBoard(run, state.selected, state.preview, state.pendingConsumable, dealIds);
  if (run.status === "selecting_blind") return renderBlindSelect(run);
  // PET-70: pack opener screen takes over while a pack is being opened. If the backend
  // somehow flags pack_open without sending the pack contents, fall through to shop.
  if (run.status === "pack_open" && run.openingPack) {
    return renderPackOpen(run, run.openingPack, state.packPicks);
  }
  if (run.status === "shop") return renderShop(run);
  return renderRunOverlay(run); // won_run | lost_run
}

let lastHandIds = new Set<string>();

function render(): void {
  // Only deal-animate cards that just entered the hand — otherwise every re-render (e.g. selecting
  // a card) replays the deal-in on all cards, which looked like the hand reshuffling.
  const onBoard = state.run?.status === "playing" && !state.anim;
  const handIds = onBoard ? state.run!.hand.map((c) => c.id) : [];
  const dealIds = new Set(handIds.filter((id) => !lastHandIds.has(id)));
  let html = screenHtml(dealIds);
  if (state.deckPeek && state.user && !state.anim) html += renderDeckPeek(state.deckPeek);
  if (state.pendingNewRun && state.user && !state.anim) {
    html += renderConfirmDialog(
      "Start a new run?",
      "This overwrites your current run.",
      "confirm-new-run",
      "cancel-new-run",
      "Start New Run",
    );
  }
  if (state.detailId && state.user && !state.anim) {
    const sheet = renderDetailFor(state.detailId, state.run);
    if (sheet) html += sheet;
    else state.detailId = null; // target vanished (e.g. after sell/buy) — drop silently
  }
  app.innerHTML = html;
  if (onBoard) lastHandIds = new Set(handIds);
  document.querySelector<HTMLInputElement>("#name-input")?.focus();
}

function setRun(run: RunStateDTO): void {
  state.run = run;
  state.selected.clear();
  state.preview = null;
  state.menuView = null;
  state.deckPeek = null;
  state.anim = null;
  state.pendingNewRun = null;
  state.detailId = null;
  state.pendingConsumable = null;
  state.packPicks.clear();
  render();
}

async function boot(): Promise<void> {
  if (state.token) {
    try {
      state.user = (await api.me(state.token)).user;
      state.run = (await api.activeRun(state.token)).run;
      state.menuView = "menu";
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      state.token = null;
      state.user = null;
    }
  }
  render();
}

// ---- auth ----

async function signIn(): Promise<void> {
  const name = document.querySelector<HTMLInputElement>("#name-input")?.value.trim();
  if (!name) return;
  try {
    const { token, user } = await api.login(name);
    state.token = token;
    state.user = user;
    localStorage.setItem(TOKEN_KEY, token);
    state.run = (await api.activeRun(token)).run;
    state.menuView = "menu";
    render();
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

function signOut(): void {
  localStorage.removeItem(TOKEN_KEY);
  state.token = null;
  state.user = null;
  state.run = null;
  state.selected.clear();
  state.preview = null;
  state.menuView = null;
  state.deckPeek = null;
  state.anim = null;
  state.detailId = null;
  state.pendingConsumable = null;
  state.packPicks.clear();
  render();
}

// ---- new-run: deck carousel + difficulty → run ----

async function gotoPlay(): Promise<void> {
  if (!state.token) return;
  try {
    state.decks = (await api.listDecks(state.token)).decks;
  } catch (err) {
    showToast((err as Error).message, "error");
    return;
  }
  // Keep the selection valid (default to the first deck if the saved one vanished).
  if (!state.decks.some((d) => d.id === state.selectedDeckId)) {
    state.selectedDeckId = state.decks[0]?.id ?? "standard";
  }
  state.menuView = "newrun";
  render();
}

/** Cycle the deck carousel (wraps around the catalog). */
function cycleDeck(dir: 1 | -1): void {
  if (state.decks.length === 0) return;
  const i = state.decks.findIndex((d) => d.id === state.selectedDeckId);
  const next = (i + dir + state.decks.length) % state.decks.length;
  state.selectedDeckId = state.decks[next]!.id;
  render();
}

function setDifficulty(difficulty: Difficulty): void {
  state.selectedDifficulty = difficulty;
  render();
}

function startRunClick(): void {
  if (!state.token) return;
  const difficulty = state.selectedDifficulty;
  if (hasActiveRun()) {
    state.pendingNewRun = { difficulty }; // confirm before overwriting the active save
    render();
    return;
  }
  void startNewRun(difficulty);
}

async function startNewRun(difficulty: Difficulty): Promise<void> {
  if (!state.token) return;
  try {
    setRun(await api.startRun(state.token, difficulty, state.selectedDeckId));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

function confirmNewRun(): void {
  const difficulty = state.pendingNewRun?.difficulty;
  state.pendingNewRun = null;
  if (difficulty) void startNewRun(difficulty);
  else render();
}

function cancelNewRun(): void {
  state.pendingNewRun = null;
  render();
}

async function beginBlind(): Promise<void> {
  if (!state.token) return;
  try {
    setRun(await api.startBlind(state.token));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

// ---- board interactions ----

let previewTimer: number | undefined;
function schedulePreview(): void {
  if (previewTimer !== undefined) clearTimeout(previewTimer);
  previewTimer = window.setTimeout(refreshPreview, 120);
}

async function refreshPreview(): Promise<void> {
  if (!state.token || !state.run || state.run.status !== "playing" || state.anim) return;
  if (state.selected.size === 0) {
    state.preview = null;
    render();
    return;
  }
  try {
    state.preview = (await api.previewPlay(state.token, [...state.selected])).preview;
  } catch {
    state.preview = null;
  }
  render();
}

function toggleCard(id: string): void {
  const run = state.run;
  if (!run || run.status !== "playing" || state.anim) return;
  // In selection mode the cap is the consumable's max, not the play-hand cap.
  const pending = state.pendingConsumable;
  const cap =
    pending && pending.def.needsSelection
      ? pending.def.needsSelection.max
      : run.maxSelect;
  if (state.selected.has(id)) state.selected.delete(id);
  else if (state.selected.size < cap) state.selected.add(id);
  render();
  // Don't fetch a play-preview while picking targets for a consumable.
  if (!pending) schedulePreview();
}

async function play(): Promise<void> {
  const run = state.run;
  if (!state.token || !run || state.selected.size === 0 || state.anim) return;
  const played = run.hand.filter((c) => state.selected.has(c.id));
  let result: RunStateDTO;
  try {
    result = await api.playHand(state.token, [...state.selected]);
  } catch (err) {
    showToast((err as Error).message, "error");
    return;
  }
  const breakdown = result.lastPlay?.breakdown;
  if (breakdown) await animateScore(played, breakdown);
  setRun(result);
}

/** Balatro-style tally: pop scoring cards (chips) → fire jokers (chips/mult/×mult) → × mult → count up.
 *  Replays only the server-provided deltas, so the on-screen total always lands on breakdown.score. */
function animateScore(played: Card[], breakdown: ScoreBreakdown): Promise<void> {
  return new Promise((resolve) => {
    const order = breakdown.scoringCardIds;
    const steps = breakdown.jokerSteps;
    const byId = new Map(played.map((c) => [c.id, c]));
    state.selected.clear();
    state.preview = null;
    state.deckPeek = null;
    state.anim = {
      played,
      breakdown,
      jokers: state.run?.jokers ?? [],
      chips: breakdown.baseChips,
      mult: breakdown.baseMult,
      highlightIndex: -1,
      jokerIndex: -1,
      phase: "intro",
      score: null,
    };
    render();

    const finish = (): void => {
      if (!state.anim) return resolve();
      state.anim.phase = "mult";
      state.anim.jokerIndex = -1;
      render();
      window.setTimeout(() => {
        if (!state.anim) return resolve();
        state.anim.phase = "total";
        state.anim.score = breakdown.score;
        render();
        window.setTimeout(resolve, 650);
      }, 360);
    };

    const stepJoker = (ji: number): void => {
      if (!state.anim) return resolve();
      if (ji >= steps.length) return finish();
      const s = steps[ji]!;
      if (s.deltaChips) state.anim.chips += s.deltaChips;
      if (s.deltaMult) state.anim.mult += s.deltaMult;
      if (s.xMult) state.anim.mult *= s.xMult;
      state.anim.jokerIndex = ji;
      state.anim.phase = "jokers";
      render();
      window.setTimeout(() => stepJoker(ji + 1), 320);
    };

    let ci = 0;
    const stepCard = (): void => {
      if (!state.anim) return resolve();
      if (ci < order.length) {
        const card = byId.get(order[ci]!);
        if (card) state.anim.chips += cardChipValue(card.rank);
        state.anim.highlightIndex = ci;
        state.anim.phase = "scoring";
        render();
        ci += 1;
        window.setTimeout(stepCard, 220);
      } else {
        stepJoker(0);
      }
    };
    window.setTimeout(stepCard, 300);
  });
}

async function discard(): Promise<void> {
  if (!state.token || !state.run || state.selected.size === 0 || state.anim) return;
  try {
    setRun(await api.discardCards(state.token, [...state.selected]));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

// ---- shop ----

async function buy(itemId: string): Promise<void> {
  if (!state.token) return;
  try {
    setRun(await api.buyItem(state.token, itemId));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

async function reroll(): Promise<void> {
  if (!state.token) return;
  try {
    setRun(await api.rerollShop(state.token));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

async function cashOutContinue(): Promise<void> {
  if (!state.token) return;
  try {
    setRun(await api.continueRun(state.token));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

// ---- jokers ----

async function sellJokerAction(jokerId: string): Promise<void> {
  if (!state.token || state.anim) return;
  try {
    setRun(await api.sellJoker(state.token, jokerId));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

// ---- consumables / skip (PET-67 scaffold; PET-71 selection mode) ----

/** Click on a consumable's "Use" → either enter selection mode (and wait for Confirm)
 *  or fire useConsumable immediately. Gated on the DTO carrying `needsSelection`:
 *  when the backend hasn't shipped that field yet, every consumable is fire-immediately
 *  and the modal flow stays dormant. (PET-71) */
async function useConsumableAction(instanceId: string): Promise<void> {
  if (!state.token || state.anim) return;
  const c = state.run?.consumables.find((x) => x.id === instanceId);
  const sel = c?.needsSelection;
  if (c && sel && sel.min > 0) {
    state.pendingConsumable = { instanceId, def: c };
    state.selected.clear();
    state.preview = null;
    state.detailId = null; // close the detail sheet that initiated the use, if any
    const target = sel.from === "hand" ? "cards" : "jokers";
    const count = sel.min === sel.max ? `${sel.min}` : `${sel.min}–${sel.max}`;
    showToast(`Pick ${count} ${target} then tap Confirm`, "info");
    render();
    return;
  }
  try {
    setRun(await api.useConsumable(state.token, instanceId, []));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

async function confirmPendingConsumable(): Promise<void> {
  const pending = state.pendingConsumable;
  if (!state.token || !pending || state.anim) return;
  const sel = pending.def.needsSelection;
  const picked = [...state.selected];
  if (sel && (picked.length < sel.min || picked.length > sel.max)) {
    const count = sel.min === sel.max ? `${sel.min}` : `${sel.min}–${sel.max}`;
    const target = sel.from === "hand" ? "cards" : "jokers";
    showToast(`Pick ${count} ${target} first`, "error");
    return;
  }
  try {
    setRun(await api.useConsumable(state.token, pending.instanceId, picked));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

function cancelPendingConsumable(): void {
  if (!state.pendingConsumable) return;
  state.pendingConsumable = null;
  state.selected.clear();
  state.preview = null;
  render();
}

async function sellConsumableAction(instanceId: string): Promise<void> {
  if (!state.token || state.anim) return;
  try {
    setRun(await api.sellConsumable(state.token, instanceId));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

async function skipBlindAction(): Promise<void> {
  if (!state.token || state.anim) return;
  try {
    setRun(await api.skipBlind(state.token));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

// ---- booster pack opener (PET-70) ------------------------------------------

/** Toggle a single pack option in/out of the local pick set. Honors picksAllowed
 *  as a hard cap (replaces the oldest pick once full — Balatro-style). */
function togglePackPick(itemId: string): void {
  const run = state.run;
  const pack = run?.openingPack;
  if (!pack || run?.status !== "pack_open" || state.anim) return;
  if (state.packPicks.has(itemId)) {
    state.packPicks.delete(itemId);
  } else if (state.packPicks.size < pack.picksAllowed) {
    state.packPicks.add(itemId);
  } else if (pack.picksAllowed === 1) {
    // single-pick UX: a new tap replaces the current pick
    state.packPicks.clear();
    state.packPicks.add(itemId);
  } else {
    showToast(`Pick at most ${pack.picksAllowed}`, "info");
    return;
  }
  render();
}

async function confirmPackAction(): Promise<void> {
  const run = state.run;
  const pack = run?.openingPack;
  if (!state.token || !pack || state.anim) return;
  if (state.packPicks.size !== pack.picksAllowed) {
    showToast(`Pick ${pack.picksAllowed} first`, "error");
    return;
  }
  try {
    setRun(await api.pickFromPack(state.token, [...state.packPicks]));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

async function skipPackAction(): Promise<void> {
  if (!state.token || state.anim) return;
  try {
    setRun(await api.skipPack(state.token));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

async function moveJokerAction(jokerId: string, dir: "left" | "right"): Promise<void> {
  if (!state.token || state.anim) return;
  try {
    setRun(await api.reorderJoker(state.token, jokerId, dir));
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

// ---- deck peek / menu ----

async function openDeckPeek(): Promise<void> {
  if (!state.token) return;
  try {
    state.deckPeek = await api.peekDeck(state.token);
    render();
  } catch (err) {
    showToast((err as Error).message, "error");
  }
}

function closeDeckPeek(): void {
  state.deckPeek = null;
  render();
}

function exitToMenu(): void {
  state.menuView = "menu"; // run stays active (auto-saved server-side); resume via Continue Run
  state.deckPeek = null;
  render();
}

async function newRun(): Promise<void> {
  state.run = null;
  await gotoPlay();
}

function goMenu(view: MenuView): void {
  state.menuView = view;
  render();
}

function resume(): void {
  state.menuView = null;
  render();
}

// ---- progressive disclosure (detail sheet / tooltip) ----

function openDetail(detailId: string): void {
  if (state.anim) return;
  state.detailId = detailId;
  render();
}

function closeDetail(): void {
  if (!state.detailId) return;
  state.detailId = null;
  render();
}

// ---- events ----

/** Action names whose handlers fire an API call; the dispatcher disables the clicked button
 *  and shows a spinner while the promise is in flight. Idempotent: if already loading, ignored. */
const ASYNC_ACTIONS = new Set([
  "signin",
  "start-run",
  "confirm-new-run",
  "start-blind",
  "play",
  "discard",
  "buy",
  "reroll",
  "continue",
  "sell-joker",
  "new-run",
  "use-consumable",
  "sell-consumable",
  "skip-blind",
  "confirm-consumable",
  // PET-70 — booster pack opener
  "confirm-pack",
  "skip-pack",
]);

/** Marks a button as in-flight (disabled + spinner) for the duration of an async handler.
 *  If render() replaces the button mid-flight (the common case after success), the new node
 *  starts fresh — no leak. On failure (no re-render), finally restores the original button. */
async function runGuarded(el: HTMLElement, fn: () => Promise<void> | void): Promise<void> {
  const btn = el as HTMLButtonElement;
  if (btn.dataset.loading === "1") return;
  const wasDisabled = btn.disabled;
  btn.dataset.loading = "1";
  btn.disabled = true;
  try {
    await fn();
  } finally {
    // If the button is still in the live DOM (no re-render occurred — e.g. error path),
    // restore it so the user can retry. Otherwise this is a no-op on a detached node.
    btn.dataset.loading = "";
    delete btn.dataset.loading;
    btn.disabled = wasDisabled;
  }
}

app.addEventListener("click", (event) => {
  const el = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  const guard = action && ASYNC_ACTIONS.has(action)
    ? (fn: () => Promise<void> | void) => void runGuarded(el, fn)
    : (fn: () => Promise<void> | void) => void fn();
  switch (action) {
    case "signin": guard(signIn); break;
    case "signout": signOut(); break;
    case "goto-play": void gotoPlay(); break;
    case "goto-settings": goMenu("settings"); break;
    case "goto-options": goMenu("options"); break;
    case "back-to-menu": goMenu("menu"); break;
    case "resume": resume(); break;
    case "deck-prev": cycleDeck(-1); break;
    case "deck-next": cycleDeck(1); break;
    case "set-difficulty": if (el.dataset.difficulty) setDifficulty(el.dataset.difficulty as Difficulty); break;
    case "start-run": guard(startRunClick); break;
    case "start-blind": guard(beginBlind); break;
    case "toggle-card": if (el.dataset.cardId) toggleCard(el.dataset.cardId); break;
    case "play": guard(play); break;
    case "discard": guard(discard); break;
    case "buy": if (el.dataset.itemId) { const id = el.dataset.itemId; guard(() => buy(id)); } break;
    case "reroll": guard(reroll); break;
    case "continue": guard(cashOutContinue); break;
    case "open-deck-peek": void openDeckPeek(); break;
    case "close-deck-peek": closeDeckPeek(); break;
    case "exit-to-menu": exitToMenu(); break;
    case "new-run": guard(newRun); break;
    case "sell-joker": if (el.dataset.jokerId) { const id = el.dataset.jokerId; guard(() => sellJokerAction(id)); } break;
    case "move-joker-left": if (el.dataset.jokerId) void moveJokerAction(el.dataset.jokerId, "left"); break;
    case "move-joker-right": if (el.dataset.jokerId) void moveJokerAction(el.dataset.jokerId, "right"); break;
    case "use-consumable": if (el.dataset.instanceId) { const id = el.dataset.instanceId; guard(() => useConsumableAction(id)); } break;
    case "sell-consumable": if (el.dataset.instanceId) { const id = el.dataset.instanceId; guard(() => sellConsumableAction(id)); } break;
    case "confirm-consumable": guard(confirmPendingConsumable); break;
    case "cancel-consumable": cancelPendingConsumable(); break;
    case "skip-blind": guard(skipBlindAction); break;
    case "pick-from-pack": if (el.dataset.itemId) togglePackPick(el.dataset.itemId); break;
    case "confirm-pack": guard(confirmPackAction); break;
    case "skip-pack": guard(skipPackAction); break;
    case "confirm-new-run": guard(() => { confirmNewRun(); }); break;
    case "cancel-new-run": cancelNewRun(); break;
    case "open-detail": if (el.dataset.detailId) openDetail(el.dataset.detailId); break;
    case "close-detail": closeDetail(); break;
    // "peek-noop" / "confirm-noop" / "sheet-noop": clicks inside a modal panel — do nothing
  }
});

app.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.target as HTMLElement).id === "name-input") {
    void signIn();
  }
});

// Esc dismisses the detail sheet (keyboard parity with outside-click on the scrim);
// when no sheet is open but a consumable is waiting on selection, Esc cancels selection mode.
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (state.detailId) {
    event.preventDefault();
    closeDetail();
  } else if (state.pendingConsumable) {
    event.preventDefault();
    cancelPendingConsumable();
  }
});

// ---- network resilience (PET-62) -----------------------------------------

/** Force a reconciliation fetch — backend is authoritative. Called when net flips back
 *  to "online" after a drop, and when the user taps the offline banner to retry. */
async function reconcileFromServer(): Promise<void> {
  if (!state.token) return;
  try {
    state.run = (await api.activeRun(state.token)).run;
    render();
  } catch {
    // request() already drove the net-status banner; nothing else to do here.
  }
}

let lastNetStatus: NetStatus = "online";
subscribeNet((next) => {
  const prev = lastNetStatus;
  lastNetStatus = next;
  if (next === "retrying" && prev === "online") {
    showToast("Connection lost — retrying…", "info");
  } else if (next === "offline") {
    showToast("Offline. Tap the banner to retry.", "error");
  } else if (next === "online" && prev !== "online") {
    // Recovered from a drop — reconcile to the server (backend stays authoritative).
    showToast("Back online", "success");
    void reconcileFromServer();
  }
});

setManualRetryHandler(() => {
  // User tapped the offline banner — try a recovery fetch now. request() will flip
  // status to "retrying" while in flight and to "online" on success (which fires the
  // subscribeNet handler above and re-renders).
  void reconcileFromServer();
});
// PWA: register the service worker on production-like origins (skips the Vite dev server). (PET-63)
registerServiceWorker();

void boot();
