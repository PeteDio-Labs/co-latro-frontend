/** Pure render functions → HTML strings. Cyber HUD theme; static class names only; responsive. */

import type {
  BlindKind,
  Card,
  DeckPeekDTO,
  DeckSummary,
  HandLevels,
  HandType,
  JokerStep,
  JokerView,
  Rank,
  RunStateDTO,
  ScoreBreakdown,
  ShopItem,
  Suit,
  User,
} from "./types.ts";

const RANK_LABEL: Record<Rank, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9",
  10: "10", 11: "J", 12: "Q", 13: "K", 14: "A",
};
const SUIT_SYMBOL: Record<Suit, string> = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
const BLIND_LABEL: Record<BlindKind, string> = {
  small: "Small Blind",
  big: "Big Blind",
  boss: "Boss Blind",
};
const BLIND_ORDER: BlindKind[] = ["small", "big", "boss"];
const BLIND_MULT: Record<BlindKind, string> = { small: "×1", big: "×1.5", boss: "×2" };
const BLIND_REWARD: Record<BlindKind, number> = { small: 3, big: 4, boss: 5 };
const HAND_NAME: Record<HandType, string> = {
  high_card: "High Card",
  pair: "Pair",
  two_pair: "Two Pair",
  three_of_a_kind: "Three of a Kind",
  straight: "Straight",
  flush: "Flush",
  full_house: "Full House",
  four_of_a_kind: "Four of a Kind",
  straight_flush: "Straight Flush",
  royal_flush: "Royal Flush",
};

/** Transient play-resolution animation state (built + stepped in main.ts). */
export interface AnimState {
  played: Card[];
  breakdown: ScoreBreakdown;
  jokers: JokerView[];
  chips: number;
  mult: number; // running mult (starts at baseMult, grows through the jokers phase)
  highlightIndex: number; // scoring card popping (-1 = none yet)
  jokerIndex: number; // index into breakdown.jokerSteps currently firing (-1 = none)
  phase: "intro" | "scoring" | "jokers" | "mult" | "total";
  score: number | null;
}

const SCREEN = "cy-screen w-full max-w-6xl mx-auto flex flex-col";

/** Top terminal status strip used across screens. */
function statusBar(left: string, right = `<span class="cy-online">Online · v0.5</span>`): string {
  return `<div class="cy-statusbar cy-statusbar--top"><span>${left}</span>${right}</div>`;
}

// ---- auth + menu -----------------------------------------------------------

export function renderSignIn(): string {
  return `
  <div class="cy-screen flex flex-col items-center justify-center gap-6 p-4 sm:p-6">
    <div class="cy-statusbar cy-statusbar--top w-full max-w-md justify-center">Arcade Terminal // auth required</div>
    <h1 class="cy-title text-center">MINI BALATRO</h1>
    <div class="cy-panel w-full max-w-md p-5 sm:p-6 flex flex-col gap-3">
      <div class="font-display text-[11px] tracking-[0.3em] uppercase text-neon-cyan">Identify // Enter Callsign</div>
      <div class="flex items-center gap-2 border border-white/20 bg-black/40 px-3 py-3">
        <span class="font-display font-bold text-neon-cyan">&gt;</span>
        <input id="name-input" type="text" maxlength="40" placeholder="callsign" autocomplete="off"
          class="flex-1 min-w-0 bg-transparent outline-none text-white font-display font-bold tracking-wide text-lg placeholder-white/30" />
      </div>
      <button data-action="signin" class="cy-btn cy-btn--go w-full">Sign In ▸</button>
    </div>
    <p class="text-[11px] tracking-[0.14em] uppercase text-white/60 text-center">No password — your <span class="text-neon-gold">callsign</span> is your account</p>
  </div>`;
}

export function renderMainMenu(user: User, activeRun: RunStateDTO | null): string {
  const resume = activeRun
    ? `<button data-action="resume" class="cy-btn cy-btn--go flex items-center gap-3 text-left">
         <span>▸</span>
         <span class="flex-1 leading-tight">Continue Run<span class="block font-body text-[10px] font-medium tracking-wide normal-case text-black/70">Ante ${activeRun.ante}/${activeRun.maxAnte} · ${BLIND_LABEL[activeRun.blindKind]} · $${activeRun.money}</span></span>
         <span class="text-[10px] tracking-widest opacity-70">RESUME</span>
       </button>`
    : "";
  return `
  <div class="${SCREEN} p-3 sm:p-4 md:p-6">
    ${statusBar("Arcade Terminal // online")}
    <div class="flex-1 grid items-center gap-6 py-6 md:grid-cols-[1.15fr_.85fr]">
      <div>
        <div class="font-display text-[11px] tracking-[0.4em] text-neon-cyan">ROGUELIKE POKER</div>
        <h1 class="cy-title mt-1">MINI<br />BALATRO</h1>
        <div class="mt-1 text-xs sm:text-sm tracking-[0.2em] uppercase text-white/70">// Hit the score · climb the antes</div>
        <div class="my-4 h-0.5 w-32" style="background:linear-gradient(90deg,#ff2e97,#00e5ff,transparent)"></div>
        <div class="flex max-w-sm flex-col gap-2.5">
          ${resume}
          ${menuButton("goto-play", "Play", "cy-btn--play", "NEW RUN")}
          ${menuButton("goto-settings", "Settings", "cy-btn--ghost")}
          ${menuButton("goto-options", "Options", "cy-btn--ghost")}
        </div>
      </div>
      <div class="hidden flex-col gap-3 sm:flex">
        <div class="cy-panel p-4">
          <div class="mb-1 font-display text-[10px] tracking-[0.28em] uppercase text-neon-cyan">Content</div>
          <div class="cy-fan"><div class="c c1">A♠</div><div class="c c2">★</div><div class="c c3">K♥</div></div>
          ${statLine("Jokers", "20", "text-neon-cyan")}
          ${statLine("Decks · Planets", "6 · 9", "text-neon-gold")}
          ${statLine("Antes", "8", "text-neon-pink")}
        </div>
      </div>
    </div>
    <div class="cy-statusbar cy-statusbar--foot">
      <span>Operator <span class="font-display text-neon-cyan">// ${escapeHtml(user.name)}</span></span>
      <button data-action="signout" class="cy-btn cy-btn--ghost cy-btn--sm">Sign Out</button>
    </div>
  </div>`;
}

function menuButton(action: string, label: string, variant: string, tail = ""): string {
  const tailHtml = tail ? `<span class="text-[10px] tracking-widest text-white/55">${tail}</span>` : "";
  return `<button data-action="${action}" class="cy-btn ${variant} flex items-center gap-3 text-left">
    <span class="text-neon-cyan">▸</span><span class="flex-1">${label}</span>${tailHtml}
  </button>`;
}

function statLine(label: string, value: string, valueColor: string): string {
  return `<div class="flex items-center justify-between border-b border-dashed border-white/10 py-1.5 last:border-0">
    <span class="text-[10px] uppercase tracking-widest text-white/60">${label}</span>
    <span class="font-display text-base font-extrabold ${valueColor}">${value}</span>
  </div>`;
}

export function renderSettings(user: User): string {
  return menuShell(
    "Settings",
    `<div class="flex flex-col gap-3 text-white/90">
       <div class="border border-white/15 bg-white/5 px-4 py-3">Account: <span class="font-display text-neon-cyan">${escapeHtml(user.name)}</span></div>
       <button data-action="signout" class="cy-btn cy-btn--ghost cy-btn--sm self-start">Sign out</button>
       <p class="text-sm text-white/40">More account settings coming soon.</p>
     </div>`,
  );
}

export function renderOptions(): string {
  return menuShell("Options", `<p class="text-white/50">Sound, animations &amp; display options coming soon.</p>`);
}

function menuShell(title: string, inner: string): string {
  return `
  <div class="cy-screen flex flex-col items-center justify-center gap-6 p-4 sm:p-6">
    <h2 class="cy-title !text-3xl sm:!text-4xl">${title}</h2>
    <div class="cy-panel cy-panel--solid w-full max-w-md p-5">${inner}</div>
    <button data-action="back-to-menu" class="cy-btn cy-btn--ghost cy-btn--sm">← Back to menu</button>
  </div>`;
}

// ---- deck select -----------------------------------------------------------

export function renderDeckSelect(decks: DeckSummary[], selectedId: string | null): string {
  return `
  <div class="cy-screen flex flex-col items-center justify-center gap-5 p-4 sm:p-6">
    <h2 class="cy-title !text-3xl sm:!text-4xl">Choose a Deck</h2>
    <div class="grid w-full max-w-3xl gap-3 sm:grid-cols-2">
      ${decks.map((d) => deckCard(d, d.id === selectedId)).join("")}
    </div>
    <button data-action="back-to-menu" class="cy-btn cy-btn--ghost cy-btn--sm">← Back to menu</button>
  </div>`;
}

function deckCard(deck: DeckSummary, selected: boolean): string {
  const perk = deckPerkText(deck);
  const sel = selected ? "cy-bd-rare cy-sel" : "";
  return `
  <button data-action="choose-deck" data-deck-id="${deck.id}"
    class="cy-panel ${sel} flex flex-col gap-1 p-4 text-left transition hover:brightness-110">
    <span class="font-display text-lg text-neon-pink neon-text">${escapeHtml(deck.name)}</span>
    <span class="text-sm text-white/80">${escapeHtml(deck.description)}</span>
    <span class="text-[11px] uppercase tracking-wide text-neon-cyan/80">${deck.size} cards${perk ? ` · ${perk}` : ""}</span>
  </button>`;
}

function deckPerkText(deck: DeckSummary): string {
  const p = deck.perk;
  const parts: string[] = [];
  if (p.extraHands) parts.push(`+${p.extraHands} hand`);
  if (p.extraDiscards) parts.push(`+${p.extraDiscards} discard`);
  if (p.startMoney) parts.push(`+$${p.startMoney} start`);
  return parts.join(" · ");
}

// ---- difficulty ------------------------------------------------------------

export function renderDifficultyPicker(deckName: string): string {
  return menuShell(
    "Choose difficulty",
    `<div class="mb-3 text-center text-sm text-white/60">Deck: <span class="text-neon-cyan">${escapeHtml(deckName)}</span></div>
     <div class="grid gap-3">
       ${difficultyButton("easy", "Easy", "Gentler · 5 hands · 4 discards")}
       ${difficultyButton("medium", "Medium", "Standard · 4 hands · 3 discards")}
       ${difficultyButton("hard", "Hard", "Brutal · 3 hands · 2 discards")}
     </div>`,
  );
}

function difficultyButton(value: string, label: string, detail: string): string {
  return `
  <button data-action="choose-difficulty" data-difficulty="${value}"
    class="cy-panel flex items-center justify-between gap-3 p-4 text-left transition hover:brightness-110">
    <span class="font-display text-lg text-white">${label}</span>
    <span class="text-right text-xs text-white/70">${detail}</span>
  </button>`;
}

// ---- blind select ----------------------------------------------------------

export function renderBlindSelect(run: RunStateDTO): string {
  const boss = run.blindKind === "boss";
  const bossTag = boss ? `<div class="cy-tag cy-tag--rare">⚠ Boss Blind</div>` : "";
  return `
  <div class="${SCREEN} gap-4 p-3 sm:p-4 md:p-6 ${boss ? "cy-boss" : ""}">
    ${topBar(run)}
    ${renderJokers(run.jokers, run.maxJokers, true)}
    <div class="flex flex-1 flex-col items-center justify-center gap-5">
      <div class="text-center">
        <div class="font-display text-xs uppercase tracking-[0.3em] text-neon-cyan">Ante ${run.ante} / ${run.maxAnte}</div>
        <h2 class="mt-1 font-display text-3xl font-black sm:text-4xl ${boss ? "text-neon-pink neon-text" : "text-white neon-cyan-text"}">${BLIND_LABEL[run.blindKind]}</h2>
      </div>
      ${bossTag}
      <div class="flex gap-3">${blindPip(0, run.blindIndex)}${blindPip(1, run.blindIndex)}${blindPip(2, run.blindIndex)}</div>
      <div class="cy-panel ${boss ? "cy-panel--pink" : ""} flex flex-col items-center gap-1 px-8 py-5 sm:px-12">
        <div class="text-[10px] uppercase tracking-widest text-white/60">Score to beat</div>
        <div class="font-display text-4xl font-black text-neon-cyan neon-cyan-text sm:text-5xl">${run.target}</div>
        <div class="mt-1 text-xs text-white/70">Reward $${BLIND_REWARD[run.blindKind]} + $1 / hand left</div>
      </div>
      <button data-action="start-blind" class="cy-btn cy-btn--play !text-base px-10">Play ${BLIND_LABEL[run.blindKind]} ▸</button>
      <div class="text-sm text-white/60">Money: <span class="font-display text-neon-gold">$${run.money}</span></div>
    </div>
  </div>`;
}

function blindPip(index: number, current: number): string {
  const cls =
    index < current
      ? "bg-neon-cyan"
      : index === current
        ? "bg-neon-pink neon-btn"
        : "bg-white/10 border border-neon-violet/40";
  return `<span class="h-3.5 w-3.5 rounded-full ${cls}"></span>`;
}

// ---- jokers ----------------------------------------------------------------

/** Row of owned jokers + empty slots. `sellable` shows Sell / ◀▶ controls. */
function renderJokers(jokers: JokerView[], maxJokers: number, sellable: boolean): string {
  const slots: string[] = [];
  for (let i = 0; i < maxJokers; i++) {
    const j = jokers[i];
    slots.push(
      j
        ? jokerCard(j, sellable, i, jokers.length)
        : `<div class="cy-slot min-h-[4.5rem] w-24 shrink-0 sm:w-28">slot</div>`,
    );
  }
  return `<div class="flex flex-wrap items-stretch justify-center gap-1.5 sm:gap-2">${slots.join("")}</div>`;
}

function jokerCard(j: JokerView, sellable: boolean, index: number, count: number): string {
  const controls = sellable
    ? `<div class="mt-auto flex items-center justify-between gap-1 pt-1">
         <button data-action="move-joker-left" data-joker-id="${j.id}" ${index === 0 ? "disabled" : ""} class="cy-mini">◀</button>
         <button data-action="sell-joker" data-joker-id="${j.id}" class="cy-mini cy-mini--gold">$${j.sellValue}</button>
         <button data-action="move-joker-right" data-joker-id="${j.id}" ${index === count - 1 ? "disabled" : ""} class="cy-mini">▶</button>
       </div>`
    : "";
  // Stagger the idle bob by ~0.35s per joker so the row breathes out of phase.
  const bobDelay = `--bob-delay:${(index * 0.35).toFixed(2)}s`;
  return `
  <div class="cy-joker joker-idle-bob flex min-h-[4.5rem] w-24 shrink-0 flex-col p-2 sm:w-28" title="${escapeHtml(j.description)}" style="${bobDelay}">
    <div class="font-display text-[11px] font-bold leading-tight text-neon-pink neon-text">${escapeHtml(j.name)}</div>
    <div class="text-[9px] leading-tight text-white/70">${escapeHtml(j.description)}</div>
    ${controls}
  </div>`;
}

// ---- board -----------------------------------------------------------------

export function renderBoard(
  run: RunStateDTO,
  selected: Set<string>,
  preview: ScoreBreakdown | null,
): string {
  const scoring = new Set(preview?.scoringCardIds ?? []);
  const cardsHtml = run.hand
    .map((c, i) => renderCard(c, selected.has(c.id), scoring.has(c.id), i))
    .join("");

  const canPlay = selected.size >= 1 && selected.size <= run.maxSelect && run.status === "playing";
  const canDiscard = canPlay && run.discardsRemaining > 0;
  const progressPct = Math.min(100, Math.round((run.totalScore / run.target) * 100));
  const boss = run.blindKind === "boss";

  const lastPlay = run.lastPlay
    ? `<div class="text-sm text-white/70">Last: <span class="font-display text-neon-pink">${run.lastPlay.breakdown.handLabel}</span> +${run.lastPlay.breakdown.score}</div>`
    : `<div class="h-5"></div>`;

  return `
  <div class="${SCREEN} gap-3 p-3 sm:p-4 md:gap-4 md:p-6 ${boss ? "cy-boss" : ""}">
    ${topBar(run)}
    <div class="flex flex-col gap-2 md:flex-row md:items-stretch md:gap-3">
      <div class="cy-panel ${boss ? "cy-panel--pink" : ""} flex min-w-[150px] flex-col justify-center px-4 py-2">
        <div class="text-[9px] uppercase tracking-[0.22em] text-white/60">Ante ${run.ante}/${run.maxAnte}</div>
        <div class="font-display text-lg font-black capitalize text-white">${BLIND_LABEL[run.blindKind]}</div>
        <div class="text-[10px] font-bold text-neon-gold">${BLIND_MULT[run.blindKind]} · Reward $${BLIND_REWARD[run.blindKind]}</div>
      </div>
      <div class="cy-panel flex flex-1 flex-col justify-center px-4 py-2">
        <div class="text-[9px] uppercase tracking-[0.28em] text-white/60">Round Score</div>
        <div class="font-display text-2xl font-black text-neon-cyan neon-cyan-text sm:text-3xl">${run.totalScore}<span class="text-base text-white/40"> / ${run.target}</span></div>
        <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div class="h-full transition-all duration-300" style="width:${progressPct}%;background:linear-gradient(90deg,#00e5ff,#8cff5b)"></div>
        </div>
      </div>
      <div class="flex flex-wrap justify-center gap-1.5 sm:gap-2 md:flex-nowrap">
        ${statTile("Money", `$${run.money}`, true)}
        ${statTile("Deck", String(run.deckRemaining))}
        ${statTile("Hands", String(run.handsRemaining))}
        ${statTile("Disc", String(run.discardsRemaining))}
      </div>
    </div>
    ${renderJokers(run.jokers, run.maxJokers, true)}
    ${renderHandLevels(run.handLevels)}

    <div class="flex flex-1 flex-col items-center justify-end gap-3 pb-1 sm:gap-4">
      ${renderPreviewLine(selected.size, preview)}
      <div class="flex flex-wrap items-end justify-center gap-1.5 sm:gap-2">${cardsHtml}</div>
    </div>

    <footer class="flex flex-col items-center gap-2 sm:gap-3">
      ${lastPlay}
      <div class="flex flex-wrap justify-center gap-2 sm:gap-3">
        <button data-action="play" ${canPlay ? "" : "disabled"} class="cy-btn cy-btn--go">Play Hand</button>
        <button data-action="discard" ${canDiscard ? "" : "disabled"} class="cy-btn cy-btn--ghost">Discard (${run.discardsRemaining})</button>
      </div>
      <p class="text-[11px] text-white/40">Select 1–${run.maxSelect} cards. Discards swap cards without using a hand.</p>
    </footer>
  </div>`;
}

/** Top utility bar: Menu (exit), deck name, Deck peek. Used on board + blind-select. */
function topBar(run: RunStateDTO): string {
  const deckPeek =
    run.deckRemaining > 0
      ? `<button data-action="open-deck-peek" class="cy-btn cy-btn--ghost cy-btn--sm">🂠 Deck ${run.deckRemaining}</button>`
      : `<span class="w-16"></span>`;
  return `
  <div class="flex items-center justify-between gap-2">
    <button data-action="exit-to-menu" class="cy-btn cy-btn--ghost cy-btn--sm">≡ Menu</button>
    <span class="truncate font-display text-xs uppercase tracking-widest text-neon-pink neon-text sm:text-sm">${escapeHtml(run.deckName)}</span>
    ${deckPeek}
  </div>`;
}

function statTile(label: string, value: string, money = false): string {
  return `<div class="cy-tile ${money ? "cy-tile--money" : ""}"><span class="k">${label}</span><span class="v">${value}</span></div>`;
}

function renderHandLevels(levels: HandLevels): string {
  const leveled = (Object.keys(levels) as HandType[]).filter((h) => levels[h] > 1);
  if (leveled.length === 0) return `<div class="h-0"></div>`;
  return `
  <div class="flex flex-wrap justify-center gap-1.5 text-xs">
    ${leveled.map((h) => `<span class="border border-neon-violet/30 bg-neon-violet/15 px-2 py-1 text-[10px] uppercase tracking-wide text-neon-cyan">${HAND_NAME[h]} Lv${levels[h]}</span>`).join("")}
  </div>`;
}

function renderPreviewLine(selectedCount: number, preview: ScoreBreakdown | null): string {
  if (selectedCount === 0) {
    return `<div class="flex h-[4.75rem] items-center text-sm uppercase tracking-wide text-white/45">Select 1–5 cards to play</div>`;
  }
  if (!preview) {
    return `<div class="flex h-[4.75rem] items-center text-white/45">…</div>`;
  }
  const lvl = preview.handLevel > 1 ? ` Lv${preview.handLevel}` : "";
  // Show only the hand's level-based chips × mult — jokers fold in (and the total adds up) during the play animation.
  const handChips = preview.baseChips + preview.scoringChips;
  return `
  <div class="flex flex-col items-center gap-2">
    <div class="font-display text-base font-bold text-neon-pink neon-text sm:text-lg">${preview.handLabel}${lvl}</div>
    <div class="flex items-center gap-2 sm:gap-3">
      <div class="cy-chip"><span class="k">Chips</span><span class="v">${handChips}</span></div>
      <span class="cy-times">×</span>
      <div class="cy-mult"><span class="k">Mult</span><span class="v">${preview.baseMult}</span></div>
    </div>
  </div>`;
}

function cardInner(card: Card): string {
  const rank = RANK_LABEL[card.rank];
  const suit = SUIT_SYMBOL[card.suit];
  return `<span class="r">${rank}</span><span class="p">${suit}</span><span class="r b">${rank}</span>`;
}

function cardColor(card: Card): string {
  return card.suit === "hearts" || card.suit === "diamonds" ? "cy-card--red" : "cy-card--black";
}

function renderCard(card: Card, selected: boolean, isScoring: boolean, index = 0): string {
  const state = isScoring ? "cy-card--scoring" : selected ? "cy-card--sel" : "";
  // Stagger the deal-in 55ms per card so the hand fans out left-to-right.
  const delay = `--deal-delay:${index * 55}ms`;
  return `<button data-action="toggle-card" data-card-id="${card.id}" class="cy-card card-deal card-hover-lift ${cardColor(card)} ${state}" style="${delay}">${cardInner(card)}</button>`;
}

// ---- play resolution (score animation) -------------------------------------

export function renderPlayResolution(anim: AnimState): string {
  const scoredOrder = anim.breakdown.scoringCardIds;
  const cardsHtml = anim.played
    .map((c) => {
      const order = scoredOrder.indexOf(c.id);
      const scored = order >= 0;
      const popped = scored && order <= anim.highlightIndex;
      return renderPlayCard(c, scored, popped);
    })
    .join("");

  const firingStep = anim.phase === "jokers" ? anim.breakdown.jokerSteps[anim.jokerIndex] : undefined;
  const firingId = firingStep?.jokerId;
  const jokersRow =
    anim.jokers.length > 0
      ? `<div class="flex flex-wrap justify-center gap-1.5 sm:gap-2">${anim.jokers
          .map((j) => {
            const firing = j.id === firingId;
            const badge = firing && firingStep ? jokerStepBadge(firingStep) : "";
            return `<div class="cy-joker ${firing ? "cy-joker--fire" : ""} relative flex min-h-[4.5rem] w-24 flex-col p-2 sm:w-28">
              <div class="font-display text-[11px] font-bold leading-tight text-neon-pink neon-text">${escapeHtml(j.name)}</div>
              <div class="text-[9px] leading-tight text-white/70">${escapeHtml(j.description)}</div>
              ${badge}
            </div>`;
          })
          .join("")}</div>`
      : "";

  const lvl = anim.breakdown.handLevel > 1 ? ` Lv${anim.breakdown.handLevel}` : "";
  const scoreBlock =
    anim.phase === "total"
      ? `<div class="font-display text-5xl font-black text-white neon-text sm:text-6xl">${anim.score}</div>`
      : `<div class="h-14 sm:h-16"></div>`;

  return `
  <div class="cy-screen flex flex-col items-center justify-center gap-5 p-4 sm:gap-6 sm:p-6">
    <div class="font-display text-2xl font-black text-neon-pink neon-text sm:text-3xl">${anim.breakdown.handLabel}${lvl}</div>
    ${jokersRow}
    <div class="flex flex-wrap items-end justify-center gap-1.5 sm:gap-2">${cardsHtml}</div>
    <div class="flex items-center gap-2 sm:gap-3">
      <div class="cy-chip"><span class="k">Chips</span><span class="v">${anim.chips}</span></div>
      <span class="cy-times">×</span>
      <div class="cy-mult"><span class="k">Mult</span><span class="v">${anim.mult}</span></div>
    </div>
    ${scoreBlock}
  </div>`;
}

function jokerStepBadge(step: JokerStep): string {
  const parts: string[] = [];
  if (step.deltaChips) parts.push(`+${step.deltaChips} Chips`);
  if (step.deltaMult) parts.push(`+${step.deltaMult} Mult`);
  if (step.xMult) parts.push(`×${step.xMult} Mult`);
  return `<div class="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-neon-pink px-2 py-0.5 text-[11px] font-bold text-[#10001a]">${parts.join(" ")}</div>`;
}

function renderPlayCard(card: Card, scored: boolean, popped: boolean): string {
  const state = popped ? "cy-card--pop" : scored ? "" : "cy-card--dim";
  return `<div class="cy-card card-play-pop ${cardColor(card)} ${state}">${cardInner(card)}</div>`;
}

// ---- shop ------------------------------------------------------------------

export function renderShop(run: RunStateDTO): string {
  const shop = run.shop;
  const slotsFull = run.jokers.length >= run.maxJokers;
  const items = shop ? shop.items.map((it) => renderShopItem(it, run.money, slotsFull)).join("") : "";
  const empty = shop && shop.items.length === 0 ? `<div class="col-span-full text-center text-white/40">Sold out — reroll or continue.</div>` : "";
  const rerollCost = shop?.rerollCost ?? 5;
  const canReroll = run.money >= rerollCost;
  const nextLabel =
    run.blindIndex < 2
      ? BLIND_LABEL[BLIND_ORDER[run.blindIndex + 1]!]
      : `Ante ${run.ante + 1} · Small Blind`;
  return `
  <div class="${SCREEN} gap-4 p-3 sm:p-4 md:p-6">
    <div class="flex flex-wrap items-center justify-center gap-3 sm:justify-start">
      <span class="font-display text-2xl font-black text-neon-lime sm:text-3xl" style="text-shadow:0 0 16px rgba(140,255,91,.6)">Blind Cleared!</span>
      <div class="cy-panel cy-panel--lime flex flex-col px-4 py-2">
        <span class="text-[9px] uppercase tracking-widest text-[#bfffb0]">Cash Out</span>
        <span class="font-display text-lg font-extrabold text-neon-lime">+$${run.pendingReward ?? 0}</span>
      </div>
      <div class="cy-panel cy-panel--gold ml-auto flex flex-col items-center px-4 py-2">
        <span class="text-[9px] uppercase tracking-widest text-[#ffe39a]">Money</span>
        <span class="font-display text-lg font-extrabold text-neon-gold">$${run.money}</span>
      </div>
    </div>
    ${renderJokers(run.jokers, run.maxJokers, true)}
    <div class="text-center font-display text-[10px] uppercase tracking-[0.3em] text-neon-cyan">Shop // Jokers · Planets</div>
    <div class="flex flex-1 items-center">
      <div class="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">${items}${empty}</div>
    </div>
    <div class="flex flex-wrap items-center justify-center gap-3">
      <button data-action="reroll" ${canReroll ? "" : "disabled"} class="cy-btn cy-btn--gold">⟲ Reroll $${rerollCost}</button>
      <span class="border border-white/15 px-3 py-1.5 text-[11px] uppercase tracking-wide text-white/70">Next — ${nextLabel}</span>
      <button data-action="continue" class="cy-btn cy-btn--play">Continue ▸</button>
    </div>
  </div>`;
}

const RARITY_CLASS: Record<string, { tag: string; bd: string }> = {
  common: { tag: "cy-tag--common", bd: "cy-bd-common" },
  uncommon: { tag: "cy-tag--uncommon", bd: "cy-bd-uncommon" },
  rare: { tag: "cy-tag--rare", bd: "cy-bd-rare" },
};

function renderShopItem(item: ShopItem, money: number, slotsFull: boolean): string {
  if (item.kind === "joker") {
    const disabled = money < item.cost || slotsFull;
    const label = slotsFull ? "Slots full" : "Buy";
    const r = RARITY_CLASS[item.rarity] ?? RARITY_CLASS.common!;
    return `
    <div class="cy-panel ${r.bd} flex min-h-[150px] flex-col gap-1.5 p-3">
      <span class="cy-tag ${r.tag}">${item.rarity}</span>
      <div class="font-display text-base font-bold leading-tight text-neon-pink neon-text sm:text-lg">${escapeHtml(item.name)}</div>
      <div class="flex-1 text-[11px] leading-tight text-white/75">${escapeHtml(item.description)}</div>
      <div class="flex items-center justify-between">
        <span class="font-display text-lg font-extrabold text-neon-gold">$${item.cost}</span>
        <button data-action="buy" data-item-id="${item.id}" ${disabled ? "disabled" : ""} class="cy-btn cy-btn--go cy-btn--sm">${label}</button>
      </div>
    </div>`;
  }
  const afford = money >= item.cost;
  return `
  <div class="cy-panel cy-bd-planet flex min-h-[150px] flex-col gap-1.5 p-3">
    <span class="cy-tag cy-tag--planet">Planet</span>
    <div class="font-display text-base font-bold leading-tight text-neon-cyan sm:text-lg">${item.name}</div>
    <div class="text-xs font-semibold text-white/85">+${item.addChips} Chips · +${item.addMult} Mult</div>
    <div class="flex-1 text-[10px] text-white/60">${HAND_NAME[item.hand]} · Lv ${item.targetLevel - 1} → ${item.targetLevel}</div>
    <div class="flex items-center justify-between">
      <span class="font-display text-lg font-extrabold text-neon-gold">$${item.cost}</span>
      <button data-action="buy" data-item-id="${item.id}" ${afford ? "" : "disabled"} class="cy-btn cy-btn--go cy-btn--sm">Buy</button>
    </div>
  </div>`;
}

// ---- deck peek -------------------------------------------------------------

export function renderDeckPeek(peek: DeckPeekDTO): string {
  return `
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-6" data-action="close-deck-peek">
    <div data-action="peek-noop" class="cy-panel cy-panel--solid flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-auto p-5">
      <h3 class="font-display text-xl font-black text-neon-pink neon-text">Deck — ${peek.remaining.total} / ${peek.composition.total} left</h3>
      ${peekSuits(peek)}
      ${peekRanks(peek)}
      <button data-action="close-deck-peek" class="cy-btn cy-btn--play cy-btn--sm self-center">Close</button>
    </div>
  </div>`;
}

function peekSuits(peek: DeckPeekDTO): string {
  const suits: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
  return `
  <div class="grid grid-cols-4 gap-2 text-center">
    ${suits
      .map(
        (s) => `<div class="border border-neon-cyan/25 bg-white/5 py-2">
          <div class="text-2xl ${s === "hearts" || s === "diamonds" ? "text-neon-pink" : "text-neon-cyan"}">${SUIT_SYMBOL[s]}</div>
          <div class="text-sm text-white/80">${peek.remaining.bySuit[s] ?? 0}<span class="text-white/40">/${peek.composition.bySuit[s] ?? 0}</span></div>
        </div>`,
      )
      .join("")}
  </div>`;
}

function peekRanks(peek: DeckPeekDTO): string {
  const ranks: Rank[] = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  return `
  <div class="grid grid-cols-5 gap-2 text-center text-sm sm:grid-cols-7">
    ${ranks
      .map(
        (r) => `<div class="border border-white/12 bg-white/5 py-1">
          <div class="font-display font-bold text-white">${RANK_LABEL[r]}</div>
          <div class="text-white/70">${peek.remaining.byRank[r] ?? 0}<span class="text-white/40">/${peek.composition.byRank[r] ?? 0}</span></div>
        </div>`,
      )
      .join("")}
  </div>`;
}

// ---- confirm dialog --------------------------------------------------------

export function renderConfirmDialog(
  title: string,
  message: string,
  confirmAction: string,
  cancelAction: string,
  confirmLabel = "Confirm",
): string {
  return `
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-6" data-action="${cancelAction}">
    <div data-action="confirm-noop" class="cy-panel cy-panel--solid flex w-full max-w-sm flex-col gap-4 p-6 text-center">
      <h3 class="font-display text-xl font-black text-neon-pink neon-text">${title}</h3>
      <p class="text-white/80">${message}</p>
      <div class="mt-1 flex justify-center gap-3">
        <button data-action="${confirmAction}" class="cy-btn cy-btn--play">${confirmLabel}</button>
        <button data-action="${cancelAction}" class="cy-btn cy-btn--ghost">Cancel</button>
      </div>
    </div>
  </div>`;
}

// ---- run end overlay -------------------------------------------------------

export function renderRunOverlay(run: RunStateDTO): string {
  const won = run.status === "won_run";
  const title = won ? "RUN COMPLETE" : "GAME OVER";
  const titleColor = won ? "text-neon-lime neon-cyan-text" : "text-neon-pink neon-text";
  const sub = won
    ? `You beat all ${run.maxAnte} antes! 🏆`
    : `Fell at Ante ${run.ante} (${BLIND_LABEL[run.blindKind]}).`;
  return `
  <div class="cy-screen flex flex-col items-center justify-center gap-5 p-6">
    <div class="cy-statusbar cy-statusbar--top w-full max-w-sm justify-center">${won ? "// victory" : "// run terminated"}</div>
    <h2 class="font-display text-4xl font-black sm:text-5xl ${titleColor}">${title}</h2>
    <p class="text-white/80">${sub}</p>
    <div class="text-white/60">Money banked: <span class="font-display text-neon-gold">$${run.money}</span></div>
    <div class="mt-1 flex flex-wrap justify-center gap-3">
      <button data-action="new-run" class="cy-btn cy-btn--play">New Run</button>
      <button data-action="back-to-menu" class="cy-btn cy-btn--ghost">Main Menu</button>
    </div>
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
