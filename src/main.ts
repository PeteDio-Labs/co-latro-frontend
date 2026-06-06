/** App entry: client state + screen router, deck-select flow, score animation, shop, deck peek. */

import "./styles.css";
import * as api from "./api.ts";
import {
  renderBlindSelect,
  renderBoard,
  renderConfirmDialog,
  renderDeckPeek,
  renderDeckSelect,
  renderDetailFor,
  renderDifficultyPicker,
  renderMainMenu,
  renderOptions,
  renderPlayResolution,
  renderRunOverlay,
  renderSettings,
  renderShop,
  renderSignIn,
  type AnimState,
} from "./ui.ts";
import type {
  Card,
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

type MenuView = "menu" | "settings" | "options" | "decks" | "difficulty";

interface ClientState {
  token: string | null;
  user: User | null;
  run: RunStateDTO | null;
  selected: Set<string>;
  preview: ScoreBreakdown | null;
  menuView: MenuView | null;
  decks: DeckSummary[];
  selectedDeckId: string;
  deckPeek: DeckPeekDTO | null;
  anim: AnimState | null;
  pendingNewRun: { difficulty: Difficulty } | null;
  detailId: string | null;
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
  deckPeek: null,
  anim: null,
  pendingNewRun: null,
  detailId: null,
};

function cardChipValue(rank: Rank): number {
  if (rank === 14) return 11;
  if (rank >= 11) return 10;
  return rank;
}

function hasActiveRun(): boolean {
  return !!state.run && state.run.status !== "won_run" && state.run.status !== "lost_run";
}

function selectedDeckName(): string {
  return state.decks.find((d) => d.id === state.selectedDeckId)?.name ?? "Standard Deck";
}

function screenHtml(): string {
  if (state.anim) return renderPlayResolution(state.anim);
  if (!state.user) return renderSignIn();
  if (state.menuView === "menu") return renderMainMenu(state.user, hasActiveRun() ? state.run : null);
  if (state.menuView === "settings") return renderSettings(state.user);
  if (state.menuView === "options") return renderOptions();
  if (state.menuView === "decks") return renderDeckSelect(state.decks, state.selectedDeckId);
  if (state.menuView === "difficulty") return renderDifficultyPicker(selectedDeckName());

  const run = state.run;
  if (!run) return renderMainMenu(state.user, null);
  if (run.status === "playing") return renderBoard(run, state.selected, state.preview);
  if (run.status === "selecting_blind") return renderBlindSelect(run);
  if (run.status === "shop") return renderShop(run);
  return renderRunOverlay(run); // won_run | lost_run
}

function render(): void {
  let html = screenHtml();
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
    alert((err as Error).message);
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
  render();
}

// ---- deck → difficulty → run ----

async function gotoPlay(): Promise<void> {
  if (!state.token) return;
  try {
    state.decks = (await api.listDecks(state.token)).decks;
  } catch (err) {
    alert((err as Error).message);
    return;
  }
  state.menuView = "decks";
  render();
}

function chooseDeck(id: string): void {
  state.selectedDeckId = id;
  state.menuView = "difficulty";
  render();
}

async function chooseDifficulty(difficulty: Difficulty): Promise<void> {
  if (!state.token) return;
  if (hasActiveRun()) {
    state.pendingNewRun = { difficulty }; // confirm before overwriting the active save
    render();
    return;
  }
  await startNewRun(difficulty);
}

async function startNewRun(difficulty: Difficulty): Promise<void> {
  if (!state.token) return;
  try {
    setRun(await api.startRun(state.token, difficulty, state.selectedDeckId));
  } catch (err) {
    alert((err as Error).message);
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
    alert((err as Error).message);
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
  if (state.selected.has(id)) state.selected.delete(id);
  else if (state.selected.size < run.maxSelect) state.selected.add(id);
  render();
  schedulePreview();
}

async function play(): Promise<void> {
  const run = state.run;
  if (!state.token || !run || state.selected.size === 0 || state.anim) return;
  const played = run.hand.filter((c) => state.selected.has(c.id));
  let result: RunStateDTO;
  try {
    result = await api.playHand(state.token, [...state.selected]);
  } catch (err) {
    alert((err as Error).message);
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
    alert((err as Error).message);
  }
}

// ---- shop ----

async function buy(itemId: string): Promise<void> {
  if (!state.token) return;
  try {
    setRun(await api.buyItem(state.token, itemId));
  } catch (err) {
    alert((err as Error).message);
  }
}

async function reroll(): Promise<void> {
  if (!state.token) return;
  try {
    setRun(await api.rerollShop(state.token));
  } catch (err) {
    alert((err as Error).message);
  }
}

async function cashOutContinue(): Promise<void> {
  if (!state.token) return;
  try {
    setRun(await api.continueRun(state.token));
  } catch (err) {
    alert((err as Error).message);
  }
}

// ---- jokers ----

async function sellJokerAction(jokerId: string): Promise<void> {
  if (!state.token || state.anim) return;
  try {
    setRun(await api.sellJoker(state.token, jokerId));
  } catch (err) {
    alert((err as Error).message);
  }
}

async function moveJokerAction(jokerId: string, dir: "left" | "right"): Promise<void> {
  if (!state.token || state.anim) return;
  try {
    setRun(await api.reorderJoker(state.token, jokerId, dir));
  } catch (err) {
    alert((err as Error).message);
  }
}

// ---- deck peek / menu ----

async function openDeckPeek(): Promise<void> {
  if (!state.token) return;
  try {
    state.deckPeek = await api.peekDeck(state.token);
    render();
  } catch (err) {
    alert((err as Error).message);
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

app.addEventListener("click", (event) => {
  const el = (event.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (!el) return;
  switch (el.dataset.action) {
    case "signin": void signIn(); break;
    case "signout": signOut(); break;
    case "goto-play": void gotoPlay(); break;
    case "goto-settings": goMenu("settings"); break;
    case "goto-options": goMenu("options"); break;
    case "back-to-menu": goMenu("menu"); break;
    case "resume": resume(); break;
    case "choose-deck": if (el.dataset.deckId) chooseDeck(el.dataset.deckId); break;
    case "choose-difficulty": void chooseDifficulty(el.dataset.difficulty as Difficulty); break;
    case "start-blind": void beginBlind(); break;
    case "toggle-card": if (el.dataset.cardId) toggleCard(el.dataset.cardId); break;
    case "play": void play(); break;
    case "discard": void discard(); break;
    case "buy": if (el.dataset.itemId) void buy(el.dataset.itemId); break;
    case "reroll": void reroll(); break;
    case "continue": void cashOutContinue(); break;
    case "open-deck-peek": void openDeckPeek(); break;
    case "close-deck-peek": closeDeckPeek(); break;
    case "exit-to-menu": exitToMenu(); break;
    case "new-run": void newRun(); break;
    case "sell-joker": if (el.dataset.jokerId) void sellJokerAction(el.dataset.jokerId); break;
    case "move-joker-left": if (el.dataset.jokerId) void moveJokerAction(el.dataset.jokerId, "left"); break;
    case "move-joker-right": if (el.dataset.jokerId) void moveJokerAction(el.dataset.jokerId, "right"); break;
    case "confirm-new-run": confirmNewRun(); break;
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

// Esc dismisses the detail sheet (keyboard parity with outside-click on the scrim).
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.detailId) {
    event.preventDefault();
    closeDetail();
  }
});

void boot();
