/** Pure render functions → HTML strings. Cyber HUD theme; static class names only; responsive. */

import type {
  BlindKind,
  BossEffect,
  Card,
  Consumable,
  Difficulty,
  DeckPeekDTO,
  DeckSummary,
  HandLevels,
  HandType,
  JokerStep,
  JokerView,
  OpeningPack,
  PackFamily,
  Rank,
  RunStateDTO,
  ScoreBreakdown,
  ShopItem,
  Suit,
  Tag,
  User,
  Voucher,
  VoucherShopItem,
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

// --- ante ladder math (mirror of backend engine/ante.ts — keep in sync) -------
// Lets the blind-select screen show every blind's real score-to-beat, not just the
// current one. target = round(ANTE_BASE[ante] × blindMult × difficultyMult).
const ANTE_BASE: readonly number[] = [0, 300, 800, 2000, 5000, 11000, 20000, 35000, 50000];
const BLIND_MULT_NUM: Record<BlindKind, number> = { small: 1, big: 1.5, boss: 2 };
const DIFFICULTY_TARGET_MULT: Record<Difficulty, number> = { easy: 0.6, medium: 1.0, hard: 1.4 };
function blindTarget(ante: number, blindIndex: number, difficulty: Difficulty): number {
  const base = ANTE_BASE[ante] ?? 0;
  const mult = BLIND_MULT_NUM[BLIND_ORDER[blindIndex] ?? "small"];
  return Math.round(base * mult * DIFFICULTY_TARGET_MULT[difficulty]);
}
const DIFFICULTY_META: Record<Difficulty, { label: string; detail: string }> = {
  easy: { label: "Easy", detail: "5 hands · 4 discards" },
  medium: { label: "Medium", detail: "4 hands · 3 discards" },
  hard: { label: "Hard", detail: "3 hands · 2 discards" },
};
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
  five_of_a_kind: "Five of a Kind",
  flush_house: "Flush House",
  flush_five: "Flush Five",
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

// ---- new-run select (deck carousel + difficulty) ---------------------------

/** Balatro-style new-run screen: ONE deck shown with ◀ ▶ arrows to cycle through the
 *  catalog, a difficulty selector, then Start Run. Replaces the old deck-grid + the
 *  separate difficulty screen. */
export function renderNewRunSelect(
  decks: DeckSummary[],
  selectedId: string,
  difficulty: Difficulty,
): string {
  const idx = Math.max(0, decks.findIndex((d) => d.id === selectedId));
  const deck = decks[idx];
  const deckPanel = deck
    ? `<div class="flex items-center justify-center gap-2 sm:gap-4">
         <button data-action="deck-prev" class="cy-arrow" aria-label="Previous deck">◀</button>
         <div class="cy-panel cy-panel--solid cy-bd-rare flex w-64 max-w-[68vw] flex-col items-center gap-2 p-5 text-center">
           <span class="text-[10px] uppercase tracking-[0.25em] text-white/45">Deck ${idx + 1} / ${decks.length}</span>
           <span class="font-display text-2xl text-neon-pink neon-text">${escapeHtml(deck.name)}</span>
           <span class="min-h-[2.5rem] text-sm text-white/80">${escapeHtml(deck.description)}</span>
           <span class="text-[11px] uppercase tracking-wide text-neon-cyan/80">${deck.size} cards${deckPerkText(deck) ? ` · ${deckPerkText(deck)}` : ""}</span>
         </div>
         <button data-action="deck-next" class="cy-arrow" aria-label="Next deck">▶</button>
       </div>`
    : `<div class="text-white/50">Loading decks…</div>`;

  const diffRow = (Object.keys(DIFFICULTY_META) as Difficulty[])
    .map((d) => {
      const meta = DIFFICULTY_META[d];
      const on = d === difficulty;
      return `<button data-action="set-difficulty" data-difficulty="${d}"
        class="cy-panel ${on ? "cy-panel--lime" : ""} flex flex-1 flex-col items-center gap-0.5 p-3 transition hover:brightness-110">
        <span class="font-display text-sm sm:text-base ${on ? "text-neon-lime" : "text-white/80"}">${meta.label}</span>
        <span class="text-[9px] sm:text-[10px] text-white/55">${meta.detail}</span>
      </button>`;
    })
    .join("");

  return `
  <div class="cy-screen flex flex-col items-center justify-center gap-5 p-4 sm:p-6">
    <h2 class="cy-title !text-3xl sm:!text-4xl">New Run</h2>
    ${deckPanel}
    <div class="flex w-full max-w-md flex-col gap-2">
      <span class="text-center text-[10px] uppercase tracking-[0.3em] text-white/45">Difficulty</span>
      <div class="flex gap-2">${diffRow}</div>
    </div>
    <button data-action="start-run" class="cy-btn cy-btn--go !px-10 !py-3 !text-base">Start Run ▶</button>
    <button data-action="back-to-menu" class="cy-btn cy-btn--ghost cy-btn--sm">← Back to menu</button>
  </div>`;
}

function deckPerkText(deck: DeckSummary): string {
  const p = deck.perk;
  const parts: string[] = [];
  if (p.extraHands) parts.push(`+${p.extraHands} hand`);
  if (p.extraDiscards) parts.push(`+${p.extraDiscards} discard`);
  if (p.startMoney) parts.push(`+$${p.startMoney} start`);
  return parts.join(" · ");
}


// ---- blind select ----------------------------------------------------------

export function renderBlindSelect(run: RunStateDTO): string {
  const boss = run.blindKind === "boss";
  // Show ALL THREE blinds of the ante as an ordered Small → Big → Boss path (per
  // ante-pack.html Screen 1) — not just the current one. The current blind is the
  // focal hero (lime, pink for boss); already-cleared blinds read CLEARED + dim;
  // still-locked blinds are dimmed (boss = NO SKIP). Only the current blind is interactive.
  const path = BLIND_ORDER.map((kind, i) => renderBlindTok(run, kind, i)).join(
    `<div class="cy-blind-spine" aria-hidden="true"></div>`,
  );
  return `
  <div class="${SCREEN} gap-4 p-3 sm:p-4 md:p-6 ${boss ? "cy-boss" : ""}">
    ${topBar(run)}
    ${renderVouchersRail(run.vouchers)}
    ${renderTagsRail(run.tags)}
    ${renderConsumablesRow(run.consumables, run.maxConsumables)}
    ${renderBossWarning(run.bossEffect)}
    ${renderJokers(run.jokers, run.maxJokers, true)}
    <div class="flex flex-1 flex-col items-center justify-center gap-5">
      <div class="font-display text-[10px] uppercase tracking-[0.28em] text-neon-cyan">Ante ${run.ante} / ${run.maxAnte} // small → big → boss</div>
      <div class="cy-blind-path">${path}</div>
      <div class="text-sm text-white/60">Money: <span class="font-display text-neon-gold">$${run.money}</span> · Hands ${run.handsRemaining} · Discards ${run.discardsRemaining}</div>
    </div>
  </div>`;
}

/** One blind token in the Small→Big→Boss path. `index` is this blind's slot (0/1/2);
 *  the run's current slot is `run.blindIndex`. Past = CLEARED, current = focal hero,
 *  future = locked. Only the current blind carries Play/Skip actions (the engine always
 *  plays the current blind — PET-78 wires the tag-reward backend). Targets come from
 *  `blindTarget()` so every blind shows its real score-to-beat, not just the current one. */
function renderBlindTok(run: RunStateDTO, kind: BlindKind, index: number): string {
  const current = run.blindIndex;
  const state: "done" | "current" | "upcoming" =
    index < current ? "done" : index === current ? "current" : "upcoming";
  const isBoss = kind === "boss";
  const target = blindTarget(run.ante, index, run.difficulty);
  const canSkip = state === "current" && (kind === "small" || kind === "big");

  const variantClass =
    state === "done"
      ? "cy-blindtok--done"
      : state === "current"
        ? isBoss
          ? "cy-blindtok--boss"
          : "cy-blindtok--current"
        : isBoss
          ? "cy-blindtok--upcoming cy-blindtok--bosshint"
          : "cy-blindtok--upcoming";

  const danger =
    isBoss && state !== "done"
      ? `<span class="cy-blindtok__danger" aria-hidden="true">⚠</span>`
      : "";

  let footer: string;
  if (state === "done") {
    footer = `<div class="cy-blindtok__cleared">✓ CLEARED</div>`;
  } else if (state === "current") {
    footer = canSkip
      ? `<div class="cy-blindtok__dual">
           <button data-action="start-blind" class="cy-btn cy-btn--play cy-btn--sm">Play ▸</button>
           <button data-action="skip-blind" class="cy-btn cy-btn--skip cy-btn--sm">Skip → Tag</button>
         </div>`
      : `<div class="cy-blindtok__dual">
           <button data-action="start-blind" class="cy-btn cy-btn--play">Play ${BLIND_LABEL[kind]} ▸</button>
         </div>
         <div class="cy-blindtok__noskip">NO SKIP — must be played</div>`;
  } else {
    footer = isBoss
      ? `<div class="cy-blindtok__noskip">🔒 NO SKIP — mandatory</div>`
      : `<div class="cy-blindtok__upcoming-lbl">Upcoming</div>`;
  }

  const tgt =
    state === "done" ? `SCORE<b><s>${target}</s></b>` : `SCORE TO BEAT<b>${target}</b>`;

  return `
  <div class="cy-blindtok ${variantClass}">
    ${danger}
    <div class="cy-blindtok__pips">${blindTokPip(0, current)}${blindTokPip(1, current)}${blindTokPip(2, current)}</div>
    <div class="cy-blindtok__kicker">Ante ${run.ante} · ${kind.toUpperCase()}</div>
    <div class="cy-blindtok__name">${BLIND_LABEL[kind].replace(/ Blind$/i, " BLIND")}</div>
    <div class="cy-blindtok__mult">${BLIND_MULT[kind]}</div>
    <div class="cy-blindtok__tgt">${tgt}</div>
    <div class="cy-blindtok__rew">$${BLIND_REWARD[kind]} + $1 / hand</div>
    ${footer}
  </div>`;
}

/** Pip for the .cy-blindtok pip row — matches ante-pack `.blindtok .pips i.on`. */
function blindTokPip(index: number, current: number): string {
  if (index < current) return `<i class="done"></i>`;
  if (index === current) return `<i class="on"></i>`;
  return `<i></i>`;
}

// ---- foundation slot containers (PET-67) ----------------------------------
// Visual reference: ante-pack.html .tagrow / .voucher / .item.pack rails — small leading
// rail label (Orbitron, 9px, 0.22em tracking, cyan) + clipped chips with role colors.

/** Owned vouchers — gold-rimmed clipped pills (per cyber.css .voucher in shop-pack).
 *  Empty when no vouchers; content streams (PET-76) populate. */
function renderVouchersRail(vouchers: Voucher[]): string {
  if (vouchers.length === 0) return `<div class="cy-vouchers cy-vouchers--empty" aria-hidden="true"></div>`;
  const items = vouchers
    .map(
      (v) => `<div class="cy-voucher" data-action="open-detail" data-detail-id="voucher:${v.id}" tabindex="0" title="${escapeHtml(v.description)}">
        <span class="cy-voucher__icon" aria-hidden="true">◆</span>
        <span class="cy-voucher__name">${escapeHtml(v.name)}</span>
      </div>`,
    )
    .join("");
  return `<div class="cy-vouchers flex flex-wrap items-center justify-center gap-1.5">
    <span class="cy-rail-lbl">Vouchers</span>${items}
  </div>`;
}

/** Carried skip-blind tags — violet-frame pills with gold star glyph
 *  (per ante-pack .tag.violet + .heldtag in the status bar). Content streams (PET-78). */
function renderTagsRail(tags: Tag[]): string {
  if (tags.length === 0) return `<div class="cy-tags cy-tags--empty" aria-hidden="true"></div>`;
  const items = tags
    .map(
      (t) => `<div class="cy-tag-pill" data-action="open-detail" data-detail-id="tag:${t.id}" tabindex="0" title="${escapeHtml(t.description)}">
        <span class="cy-tag-pill__icon" aria-hidden="true">★</span>
        <span class="cy-tag-pill__name">${escapeHtml(t.name)}</span>
      </div>`,
    )
    .join("");
  return `<div class="cy-tags flex flex-wrap items-center justify-center gap-1.5">
    <span class="cy-rail-lbl">Tags</span>${items}
  </div>`;
}

/** Owned consumables row (tarot/planet/spectral) — violet-accent chips per
 *  ante-pack .item.pack + .jchip clip-path. Empty slot placeholders + owned items. */
function renderConsumablesRow(consumables: Consumable[], maxConsumables: number): string {
  const slotCount = Math.max(maxConsumables, consumables.length);
  if (slotCount === 0) return `<div class="cy-consumables cy-consumables--empty" aria-hidden="true"></div>`;
  const slots: string[] = [];
  for (let i = 0; i < slotCount; i++) {
    const c = consumables[i];
    slots.push(
      c
        ? `<div class="cy-consumable" data-action="open-detail" data-detail-id="consumable:${c.id}" tabindex="0" title="${escapeHtml(c.description)}">
            <span class="cy-consumable__kind">${c.kind}</span>
            <span class="cy-consumable__name">${escapeHtml(c.name)}</span>
          </div>`
        : `<div class="cy-slot cy-consumable-slot min-h-[3.5rem] w-20 shrink-0 sm:w-24">slot</div>`,
    );
  }
  return `<div class="cy-consumables flex flex-wrap items-stretch justify-center gap-1.5 sm:gap-2">
    <span class="cy-rail-lbl">Consumables</span>${slots.join("")}
  </div>`;
}

/** Boss-effect danger banner — pink-tinted full-width callout with chevron warn glyph.
 *  Mirrors ante-pack .node.boss treatment (pink left border, danger tint, .beff body).
 *  Only renders when a boss effect is active. */
function renderBossWarning(bossEffect: BossEffect | null): string {
  if (!bossEffect) return "";
  return `<div class="cy-boss-warning" role="status">
    <span class="cy-boss-warning__icon" aria-hidden="true">⚠</span>
    <span class="cy-boss-warning__title">${escapeHtml(bossEffect.name)}</span>
    <span class="cy-boss-warning__body">${escapeHtml(bossEffect.description)}</span>
  </div>`;
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
  // Idle bob (PET-77) staggered per index + detail-sheet hook on tap (PET-85).
  const bobDelay = `--bob-delay:${(index * 0.35).toFixed(2)}s`;
  return `
  <div class="cy-joker joker-idle-bob flex min-h-[4.5rem] w-24 shrink-0 flex-col p-2 sm:w-28"
       data-action="open-detail" data-detail-id="joker:${j.id}" tabindex="0"
       title="${escapeHtml(j.description)}" style="${bobDelay}">

    <div class="font-display text-[11px] font-bold leading-tight text-neon-pink neon-text">${escapeHtml(j.name)}</div>
    <div class="text-[9px] leading-tight text-white/70">${escapeHtml(j.description)}</div>
    ${controls}
    <div class="cy-tip" aria-hidden="true">
      <div class="cy-tip__title">${escapeHtml(j.name)}</div>
      <div class="cy-tip__body">${escapeHtml(j.description)}</div>
    </div>
  </div>`;
}

// ---- board -----------------------------------------------------------------

export function renderBoard(
  run: RunStateDTO,
  selected: Set<string>,
  preview: ScoreBreakdown | null,
  pendingConsumable: { instanceId: string; def: Consumable } | null = null,
  dealIds: Set<string> = new Set(),
): string {
  const scoring = new Set(preview?.scoringCardIds ?? []);
  const cardsHtml = run.hand
    .map((c, i) => renderCard(c, selected.has(c.id), scoring.has(c.id), i, dealIds.has(c.id)))
    .join("");

  // While picking targets for a consumable, hide play/discard so the only commit path
  // is Confirm/Cancel on the prompt — keeps the board state-machine unambiguous (PET-71).
  const inSelection = pendingConsumable !== null;
  const canPlay =
    !inSelection && selected.size >= 1 && selected.size <= run.maxSelect && run.status === "playing";
  const canDiscard = canPlay && run.discardsRemaining > 0;
  const progressPct = Math.min(100, Math.round((run.totalScore / run.target) * 100));
  const boss = run.blindKind === "boss";

  const lastPlay = run.lastPlay
    ? `<div class="text-sm text-white/70">Last: <span class="font-display text-neon-pink">${run.lastPlay.breakdown.handLabel}</span> +${run.lastPlay.breakdown.score}</div>`
    : `<div class="h-5"></div>`;

  const selectionPrompt = pendingConsumable
    ? renderConsumableSelectionPrompt(pendingConsumable.def, selected.size)
    : "";

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
    ${renderVouchersRail(run.vouchers)}
    ${renderTagsRail(run.tags)}
    ${renderConsumablesRow(run.consumables, run.maxConsumables)}
    ${renderBossWarning(run.bossEffect)}
    ${renderJokers(run.jokers, run.maxJokers, true)}
    ${renderHandLevels(run.handLevels)}

    <div class="flex flex-1 flex-col items-center justify-end gap-3 pb-1 sm:gap-4">
      ${inSelection ? "" : renderPreviewLine(selected.size, preview)}
      ${selectionPrompt}
      <div class="flex flex-wrap items-end justify-center gap-1.5 sm:gap-2">${cardsHtml}</div>
    </div>

    <footer class="flex flex-col items-center gap-2 sm:gap-3">
      ${inSelection ? "" : lastPlay}
      <div class="flex flex-wrap justify-center gap-2 sm:gap-3">
        ${inSelection
          ? renderConsumableConfirmRow(pendingConsumable!.def, selected.size)
          : `<button data-action="play" ${canPlay ? "" : "disabled"} class="cy-btn cy-btn--go">Play Hand</button>
             <button data-action="discard" ${canDiscard ? "" : "disabled"} class="cy-btn cy-btn--ghost">Discard (${run.discardsRemaining})</button>`}
      </div>
      <p class="text-[11px] text-white/40">${
        inSelection
          ? "Cancel to return to the hand."
          : `Select 1–${run.maxSelect} cards. Discards swap cards without using a hand.`
      }</p>
    </footer>
  </div>`;
}

/** Top-of-cards banner shown while a consumable is awaiting target selection (PET-71).
 *  Renders consumable name + a live N/Max counter so the player can see when Confirm unlocks.
 *  Cyber-HUD strip: pink-tinted, clip-path frame, violet kind chip (per design-pack.html
 *  panel + .rtag.legendary recipe). Counter goes lime when in valid range. */
function renderConsumableSelectionPrompt(def: Consumable, picked: number): string {
  const sel = def.needsSelection;
  if (!sel) return "";
  const target = sel.from === "hand" ? "cards" : "jokers";
  const range = sel.min === sel.max ? `${sel.min}` : `${sel.min}–${sel.max}`;
  const ready = picked >= sel.min && picked <= sel.max;
  return `
  <div class="cy-consu-prompt" role="status">
    <span class="cy-consu-prompt__kind">${escapeHtml(def.kind)}</span>
    <span class="cy-consu-prompt__name">${escapeHtml(def.name)}</span>
    <span class="cy-consu-prompt__instr">
      Pick ${range} ${target} ·
      <span class="cy-consu-prompt__count${ready ? " cy-consu-prompt__count--ready" : ""}">${picked}/${sel.max}</span>
    </span>
  </div>`;
}

/** Confirm / Cancel pair that replaces Play / Discard during consumable selection (PET-71). */
function renderConsumableConfirmRow(def: Consumable, picked: number): string {
  const sel = def.needsSelection;
  if (!sel) return "";
  const ready = picked >= sel.min && picked <= sel.max;
  return `
    <button data-action="confirm-consumable" ${ready ? "" : "disabled"} class="cy-btn cy-btn--play">Confirm</button>
    <button data-action="cancel-consumable" class="cy-btn cy-btn--ghost">Cancel</button>
  `;
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
    <div class="font-display text-base font-bold text-neon-lime neon-lime-text sm:text-lg">${preview.handLabel}${lvl}</div>
    <div class="flex items-center gap-2 sm:gap-3">
      <div class="cy-chip"><span class="k">Chips</span><span class="v">${handChips}</span></div>
      <span class="cy-times">×</span>
      <div class="cy-mult"><span class="k">Mult</span><span class="v">${preview.baseMult}</span></div>
    </div>
  </div>`;
}

function cardInner(card: Card): string {
  if (card.faceDown) {
    // Face-down card back (PET-83). No rank/suit/modifier badges leak through —
    // the visual is a violet card-back tile with a neon "?" glyph.
    return `<span class="cy-card__back" aria-hidden="true"><span class="cy-card__back-q">?</span></span>`;
  }
  const rank = RANK_LABEL[card.rank];
  const suit = SUIT_SYMBOL[card.suit];
  return `<span class="r">${rank}</span><span class="p">${suit}</span><span class="r b">${rank}</span>${cardBadges(card)}`;
}

/** Tiny modifier badge slots — render only when the corresponding modifier is set (PET-67). */
function cardBadges(card: Card): string {
  const badges: string[] = [];
  if (card.enhancement) badges.push(`<span class="card-enh-${card.enhancement}" aria-hidden="true"></span>`);
  if (card.edition) badges.push(`<span class="card-ed-${card.edition}" aria-hidden="true"></span>`);
  if (card.seal) badges.push(`<span class="card-seal-${card.seal}" aria-hidden="true"></span>`);
  if (badges.length === 0) return "";
  return `<span class="card-mods" aria-hidden="true">${badges.join("")}</span>`;
}

function cardColor(card: Card): string {
  return card.suit === "hearts" || card.suit === "diamonds" ? "cy-card--red" : "cy-card--black";
}

/** Edition shimmer alias: PET-77 already ships .card-foil/.card-holo/.card-poly. */
function cardEditionShimmer(card: Card): string {
  if (!card.edition) return "";
  if (card.edition === "foil") return " card-foil";
  if (card.edition === "holo") return " card-holo";
  if (card.edition === "poly") return " card-poly";
  // "negative" is a marker; no shimmer alias (visual lands with PET-75 if desired).
  return "";
}

function renderCard(card: Card, selected: boolean, isScoring: boolean, index = 0, deal = false): string {
  const state = isScoring ? "cy-card--scoring" : selected ? "cy-card--sel" : "";
  // Deal-in stagger (PET-77) — applied ONLY to cards newly entering the hand. Re-rendering on
  // every selection used to replay this on all cards, which read as the hand reshuffling.
  const dealCls = deal ? " card-deal" : "";
  const delay = deal ? `--deal-delay:${index * 55}ms` : "";
  // Face-down (PET-83): still selectable (player can play a face-down card), but visually
  // marked as a card-back. Skip the edition shimmer alias so it can't leak rank/edition info.
  const faceDown = card.faceDown === true;
  const fd = faceDown ? " cy-card--facedown" : "";
  const shimmer = faceDown ? "" : cardEditionShimmer(card);
  const tooltip = faceDown ? ' title="Face-down (boss effect)"' : "";
  return `<button data-action="toggle-card" data-card-id="${card.id}" class="cy-card${dealCls} card-hover-lift${shimmer} ${cardColor(card)} ${state}${fd}" style="${delay}"${tooltip}>${cardInner(card)}<span class="cy-card__info" data-action="open-detail" data-detail-id="card:${card.id}" aria-label="Card details" role="button" tabindex="0">i</span></button>`;
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

  // Hand name + level pill mirror ante-pack `.dir2 .handname` + `.handname small`
  // (Orbitron 800 16px name · lime "LV N" pill 11px). The total readout below
  // uses .cy-chip / .cy-mult (which already match ante-pack's `.chipbox` / `.multbox`).
  const lvlPill =
    anim.breakdown.handLevel > 1
      ? `<span class="cy-handname__lvl">LV ${anim.breakdown.handLevel}</span>`
      : "";
  const scoreBlock =
    anim.phase === "total"
      ? `<div class="cy-final-score">${anim.score}</div>`
      : `<div class="h-14 sm:h-16"></div>`;

  return `
  <div class="cy-screen flex flex-col items-center justify-center gap-5 p-4 sm:gap-6 sm:p-6">
    <div class="cy-handname">${escapeHtml(anim.breakdown.handLabel)}${lvlPill}</div>
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
  // PET-83: backend reveals face-down cards at score time (clears the faceDown flag in
  // lastPlay). Defensively strip the flag here so the score animation never renders a
  // card-back — if something slipped through, the reveal still happens visually.
  const revealed: Card = card.faceDown ? { ...card, faceDown: false } : card;
  return `<div class="cy-card card-play-pop ${cardColor(revealed)} ${state}">${cardInner(revealed)}</div>`;
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
  const voucherSlot = shop?.voucher ? renderShopVoucherSlot(shop.voucher, run.money) : "";
  // Slim shop HUD mirroring shop-pack.html .hud: "ANTE X/Y · NEXT <BLIND>" · Cashed-out chip · bright money on the right.
  // The breakdown (base + $1/hand + interest) is surfaced as a hover title when the backend sends it.
  const bd = run.pendingRewardBreakdown;
  const cashedTitle = bd
    ? ` title="Blind $${bd.blindBase} + hands $${bd.handsBonus} + interest $${bd.interest}"`
    : "";
  const cashedChip =
    (run.pendingReward ?? 0) > 0
      ? `<span class="cy-shop-hud__cashed"${cashedTitle}>Cashed out +$${run.pendingReward}</span>`
      : "";
  return `
  <div class="${SCREEN} gap-4 p-3 sm:p-4 md:p-6">
    <div class="cy-shop-hud">
      <span class="cy-shop-hud__ctx">ANTE <b>${run.ante} / ${run.maxAnte}</b> · NEXT ${nextLabel.toUpperCase()}</span>
      ${cashedChip}
      <span class="cy-shop-hud__money"><span class="cy-shop-hud__moneyk">$</span><span class="cy-shop-hud__moneyv">${run.money}</span></span>
    </div>
    ${renderVouchersRail(run.vouchers)}
    ${renderTagsRail(run.tags)}
    ${renderConsumablesRow(run.consumables, run.maxConsumables)}
    ${renderJokers(run.jokers, run.maxJokers, true)}
    <div class="cy-shelflbl">Shop roll // rerollable</div>
    <div class="flex flex-1 items-center">
      <div class="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">${items}${empty}</div>
    </div>
    ${voucherSlot}
    <div class="cy-shop-actionbar">
      <button data-action="reroll" ${canReroll ? "" : "disabled"} class="cy-btn cy-btn--gold cy-shop-actionbar__reroll">⟲ Reroll $${rerollCost}<small>+$1 · roll only</small></button>
      <span class="cy-shop-actionbar__nextchip">Next <b>${nextLabel}</b></span>
      <button data-action="continue" class="cy-btn cy-btn--play cy-shop-actionbar__continue">Continue ▸</button>
    </div>
  </div>`;
}

/** Single voucher slot rendered below the main shop grid (PET-67 scaffold; PET-76 fills it).
 *  Mirrors shop-pack.html `.voucher` — gold-accent, PERMANENT tag, "survives reroll" lock note. */
function renderShopVoucherSlot(voucher: VoucherShopItem, money: number): string {
  const afford = money >= voucher.cost;
  return `
  <div class="cy-voucher-slot mx-auto w-full max-w-3xl"
       data-action="open-detail" data-detail-id="shop:${voucher.id}" tabindex="0">
    <span class="cy-voucher-slot__idtag">PET-76</span>
    <div class="cy-voucher-slot__body">
      <div class="cy-voucher-slot__kicker">VOUCHER · PERMANENT</div>
      <div class="cy-voucher-slot__name">${escapeHtml(voucher.name)}</div>
      <div class="cy-voucher-slot__desc">${escapeHtml(voucher.description)}</div>
      <div class="cy-voucher-slot__lock">// SURVIVES REROLL · one per shop</div>
    </div>
    <span class="cy-voucher-slot__cost">$${voucher.cost}</span>
    <button data-action="buy" data-item-id="voucher:${voucher.voucherId}" ${afford ? "" : "disabled"} class="cy-voucher-slot__buy">Buy</button>
  </div>`;
}

/** Per-kind accent palette — matches shop-pack.html `.gcard.<variant>` left/top border + tag color.
 *  Role palette: cyan=chips/common · pink=mult/rare · violet=frame/pack/arcana · gold=money/planet/voucher · lime=affordable/standard. */
const SHOP_ACCENT: Record<string, string> = {
  common: "cy-shop-card--common",
  uncommon: "cy-shop-card--uncommon",
  rare: "cy-shop-card--rare",
  planet: "cy-shop-card--planet",
  consumable: "cy-shop-card--consumable",
  voucher: "cy-shop-card--voucher",
  // pack families
  arcana: "cy-shop-card--arcana",
  celestial: "cy-shop-card--celestial",
  buffoon: "cy-shop-card--buffoon",
  spectral: "cy-shop-card--spectral",
  standard: "cy-shop-card--standard",
};

/** Wrap a shop item card in the shared shop-card shell (mirrors shop-pack.html `.gcard`):
 *  thin colored top border per accent, RTAG chip, name, effect, cost + Buy CTA. */
function shopCard(opts: {
  id: string;
  accent: string;
  tag: string;
  name: string;
  effect: string;
  cost: number;
  afford: boolean;
  affordTip?: string; // tooltip when the Buy button is disabled (e.g. "Slots full")
  buyItemId: string; // explicit item-id (vouchers use a "voucher:" prefix)
  buyLabel?: string;
  extra?: string; // optional small note line under effect (e.g. "Normal tier" or hand label)
}): string {
  const accentCls = SHOP_ACCENT[opts.accent] ?? SHOP_ACCENT.common!;
  const buyLabel = opts.buyLabel ?? (opts.afford ? "Buy" : `$${opts.cost}`);
  const buyAttrs = opts.afford ? "" : "disabled";
  return `
  <div class="cy-shop-card ${accentCls} cursor-pointer"
       data-action="open-detail" data-detail-id="shop:${opts.id}" tabindex="0">
    <span class="cy-shop-card__rtag">${escapeHtml(opts.tag)}</span>
    <div class="cy-shop-card__name">${escapeHtml(opts.name)}</div>
    <div class="cy-shop-card__effect">${escapeHtml(opts.effect)}${
      opts.extra ? `<span class="cy-shop-card__extra">${escapeHtml(opts.extra)}</span>` : ""
    }</div>
    <div class="cy-shop-card__row">
      <span class="cy-shop-card__cost">$${opts.cost}</span>
      <button data-action="buy" data-item-id="${opts.buyItemId}" ${buyAttrs}
        ${opts.affordTip ? `title="${escapeHtml(opts.affordTip)}"` : ""}
        class="cy-shop-card__buy">${escapeHtml(buyLabel)}</button>
    </div>
  </div>`;
}

function renderShopItem(item: ShopItem, money: number, slotsFull: boolean): string {
  // The panel surface opens a detail sheet (full description + cost + Buy).
  // The inline Buy button keeps working — click handler on Buy fires first via closest("[data-action]").
  if (item.kind === "joker") {
    const disabled = money < item.cost || slotsFull;
    const label = slotsFull ? "Slots full" : "Buy";
    return shopCard({
      id: item.id,
      accent: item.rarity,
      tag: item.rarity.toUpperCase(),
      name: item.name,
      effect: item.description,
      cost: item.cost,
      afford: !disabled,
      affordTip: slotsFull ? "Joker slots full" : undefined,
      buyItemId: item.id,
      buyLabel: label,
    });
  }
  if (item.kind === "planet") {
    return shopCard({
      id: item.id,
      accent: "planet",
      tag: "PLANET",
      name: item.name,
      effect: `+${item.addChips} Chips · +${item.addMult} Mult`,
      extra: `${HAND_NAME[item.hand]} · Lv ${item.targetLevel - 1} → ${item.targetLevel}`,
      cost: item.cost,
      afford: money >= item.cost,
      buyItemId: item.id,
    });
  }
  if (item.kind === "consumable") {
    return shopCard({
      id: item.id,
      accent: "consumable",
      tag: item.consumableKind.toUpperCase(),
      name: item.name,
      effect: item.description,
      cost: item.cost,
      afford: money >= item.cost,
      buyItemId: item.id,
    });
  }
  if (item.kind === "pack") {
    return shopCard({
      id: item.id,
      accent: item.family, // arcana / celestial / buffoon / spectral / standard
      tag: item.family.toUpperCase(),
      name: item.name,
      effect: `Choose ${item.picksAllowed} of ${item.optionsCount}`,
      extra: item.description,
      cost: item.cost,
      afford: money >= item.cost,
      buyItemId: item.id,
    });
  }
  // voucher (in-grid variant — the dedicated slot below the grid is preferred, but a shop may emit one here)
  return shopCard({
    id: item.id,
    accent: "voucher",
    tag: "VOUCHER",
    name: item.name,
    effect: item.description,
    cost: item.cost,
    afford: money >= item.cost,
    buyItemId: `voucher:${item.voucherId}`,
  });
}

// ---- pack open (PET-70) ----------------------------------------------------

/** Booster-pack opener: choose N of M overlay on top of a dimmed shop background.
 *  Mirrors ante-pack.html Screen 3 (.overlay + .fan + .pc) and uses the family-accent
 *  palette from shop-pack.html (arcana=violet · celestial=gold · etc.). */
export function renderPackOpen(run: RunStateDTO, pack: OpeningPack, picks: Set<string>): string {
  const familyClass = `cy-pack--${pack.family}`;
  const canConfirm = picks.size === pack.picksAllowed;
  const optionsHtml = pack.options
    .map((opt, i) => {
      const selected = picks.has(opt.id);
      const badge = opt.badge ?? toRoman(i);
      const icon = opt.icon ?? defaultPackIcon(pack.family);
      return `
      <button data-action="pick-from-pack" data-item-id="${escapeHtml(opt.id)}"
        class="cy-pack__pc ${selected ? "cy-pack__pc--sel" : ""}"
        aria-pressed="${selected}">
        <span class="cy-pack__pc-num">${escapeHtml(badge)}</span>
        <span class="cy-pack__pc-icon" aria-hidden="true">${icon}</span>
        <span class="cy-pack__pc-name">${escapeHtml(opt.name)}</span>
        <span class="cy-pack__pc-eff">${escapeHtml(opt.description)}</span>
      </button>`;
    })
    .join("");

  // dimmed shop "behind" — purely decorative; pulls the player into the overlay.
  const behindItems = (run.shop?.items ?? [])
    .slice(0, 3)
    .map(
      (it) => `<div class="cy-pack__behind-item"><div class="cy-pack__behind-nm">${escapeHtml(
        it.kind === "joker" || it.kind === "planet" || it.kind === "voucher" || it.kind === "consumable" || it.kind === "pack" ? it.name : "",
      )}</div></div>`,
    )
    .join("");

  const confirmLabel =
    pack.picksAllowed === 1
      ? `Take ${picks.size === 1 ? picksLabel(pack, picks) : "selection"} ▸`
      : `Confirm ${picks.size}/${pack.picksAllowed} ▸`;

  return `
  <div class="${SCREEN} ${familyClass} gap-0 p-0">
    <div class="cy-shop-hud">
      <span class="cy-shop-hud__ctx">Shop // opening booster pack</span>
      <span class="cy-shop-hud__money"><span class="cy-shop-hud__moneyk">$</span><span class="cy-shop-hud__moneyv">${run.money}</span></span>
    </div>
    <div class="cy-pack-stage">
      <div class="cy-pack__behind" aria-hidden="true">${behindItems}</div>
      <div class="cy-pack__dim" aria-hidden="true"></div>
      <div class="cy-pack__overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(pack.name)}">
        <div class="cy-pack__ohdr">
          <span class="cy-pack__ofam">${pack.family.toUpperCase()}</span>
          <span class="cy-pack__otitle">${escapeHtml(pack.name.toUpperCase())}</span>
        </div>
        <div class="cy-pack__opick">CHOOSE ${pack.picksAllowed} OF ${pack.options.length}</div>
        <div class="cy-pack__fan">${optionsHtml}</div>
        <div class="cy-pack__footer">
          <button data-action="confirm-pack" ${canConfirm ? "" : "disabled"} class="cy-btn cy-btn--play">${confirmLabel}</button>
          <button data-action="skip-pack" class="cy-btn cy-btn--ghost">Skip Pack</button>
        </div>
      </div>
    </div>
  </div>`;
}

function picksLabel(pack: OpeningPack, picks: Set<string>): string {
  const id = [...picks][0];
  const opt = pack.options.find((o) => o.id === id);
  return opt ? opt.name : "selection";
}

const ROMAN: string[] = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
function toRoman(i: number): string {
  return ROMAN[i] ?? String(i);
}

/** Default glyph per pack family — overridden by `option.icon` when set. */
function defaultPackIcon(family: PackFamily): string {
  switch (family) {
    case "arcana":
      return "✦";
    case "celestial":
      return "☀";
    case "buffoon":
      return "★";
    case "spectral":
      return "◈";
    case "standard":
      return "♠";
  }
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

// ---- detail sheet (progressive disclosure) --------------------------------

export interface DetailAction {
  action: string; // data-action value
  label: string;
  variant?: "play" | "go" | "ghost" | "gold";
  data?: Record<string, string>; // extra data-* attrs (e.g. data-joker-id)
  disabled?: boolean;
}

/** Reusable bottom-sheet (mobile) / right-docked panel (desktop ≥ 768px).
 *  Tap outside or Esc dismisses (wired in main.ts via close-detail). */
export function renderDetailSheet(opts: { title: string; body: string; actions?: DetailAction[] }): string {
  const actionsHtml = (opts.actions ?? [])
    .map((a) => {
      const variant = a.variant ? `cy-btn--${a.variant}` : "cy-btn--ghost";
      const extra = a.data
        ? Object.entries(a.data)
            .map(([k, v]) => `data-${k}="${escapeHtml(v)}"`)
            .join(" ")
        : "";
      return `<button data-action="${a.action}" ${extra} ${a.disabled ? "disabled" : ""} class="cy-btn ${variant} cy-btn--sm">${escapeHtml(a.label)}</button>`;
    })
    .join("");
  return `
  <div class="cy-sheet-scrim" data-action="close-detail">
    <div class="cy-sheet" role="dialog" aria-modal="true" aria-label="${escapeHtml(opts.title)}" data-action="sheet-noop">
      <div class="cy-sheet__grab"></div>
      <h3 class="cy-sheet__title">${escapeHtml(opts.title)}</h3>
      <div class="cy-sheet__body">${opts.body}</div>
      <div class="cy-sheet__actions">
        ${actionsHtml}
        <button data-action="close-detail" class="cy-sheet__close">Close</button>
      </div>
    </div>
  </div>`;
}

/** Build the detail sheet for `<kind>:<id>` against the active run. Returns null if not found. */
export function renderDetailFor(detailId: string, run: RunStateDTO | null): string | null {
  if (!run) return null;
  const [kind, id] = detailId.split(":", 2) as [string, string];
  if (!kind || !id) return null;
  if (kind === "joker") {
    const j = run.jokers.find((x) => x.id === id);
    if (!j) return null;
    return renderDetailSheet({
      title: j.name,
      body: `<p>${escapeHtml(j.description)}</p>`,
      actions: [
        { action: "sell-joker", label: `Sell · $${j.sellValue}`, variant: "gold", data: { "joker-id": j.id } },
      ],
    });
  }
  if (kind === "card") {
    const c = run.hand.find((x) => x.id === id);
    if (!c) return null;
    // Face-down (PET-83) — hide rank/suit/modifier info; revealed at score time.
    if (c.faceDown) {
      return renderDetailSheet({
        title: "Face-down",
        body: `<p class="text-[11px] uppercase tracking-widest text-neon-violet">Boss effect</p>
               <p class="mt-1">Face-down — revealed at score time.</p>`,
      });
    }
    const suitName = c.suit.charAt(0).toUpperCase() + c.suit.slice(1);
    return renderDetailSheet({
      title: `${RANK_LABEL[c.rank]}${SUIT_SYMBOL[c.suit]} — ${suitName}`,
      body: `<p>Rank <span class="text-neon-cyan">${RANK_LABEL[c.rank]}</span> · Suit <span class="text-neon-pink">${suitName}</span></p>
             <p class="mt-1 text-white/55">Modifiers will land with PET-75 (editions, enhancements, seals).</p>`,
    });
  }
  if (kind === "shop") {
    const it =
      run.shop?.items.find((x) => x.id === id) ??
      (run.shop?.voucher && run.shop.voucher.id === id ? run.shop.voucher : undefined);
    if (!it) return null;
    if (it.kind === "joker") {
      const slotsFull = run.jokers.length >= run.maxJokers;
      const disabled = run.money < it.cost || slotsFull;
      const buyLabel = slotsFull ? "Slots full" : `Buy · $${it.cost}`;
      return renderDetailSheet({
        title: it.name,
        body: `<p class="text-[11px] uppercase tracking-widest text-neon-cyan">${it.rarity}</p>
               <p class="mt-1">${escapeHtml(it.description)}</p>`,
        actions: [{ action: "buy", label: buyLabel, variant: "go", data: { "item-id": it.id }, disabled }],
      });
    }
    if (it.kind === "planet") {
      const afford = run.money >= it.cost;
      return renderDetailSheet({
        title: it.name,
        body: `<p class="text-[11px] uppercase tracking-widest text-neon-gold">Planet</p>
               <p class="mt-1">+${it.addChips} Chips · +${it.addMult} Mult to <span class="text-neon-pink">${HAND_NAME[it.hand]}</span></p>
               <p class="mt-1 text-white/60">Lv ${it.targetLevel - 1} → ${it.targetLevel}</p>`,
        actions: [
          { action: "buy", label: `Buy · $${it.cost}`, variant: "go", data: { "item-id": it.id }, disabled: !afford },
        ],
      });
    }
    if (it.kind === "consumable") {
      const afford = run.money >= it.cost;
      return renderDetailSheet({
        title: it.name,
        body: `<p class="text-[11px] uppercase tracking-widest text-neon-gold">${it.consumableKind}</p>
               <p class="mt-1">${escapeHtml(it.description)}</p>`,
        actions: [
          { action: "buy", label: `Buy · $${it.cost}`, variant: "go", data: { "item-id": it.id }, disabled: !afford },
        ],
      });
    }
    if (it.kind === "pack") {
      const afford = run.money >= it.cost;
      return renderDetailSheet({
        title: it.name,
        body: `<p class="text-[11px] uppercase tracking-widest text-neon-violet">${it.family} pack</p>
               <p class="mt-1">Choose <span class="text-neon-lime">${it.picksAllowed}</span> of <span class="text-neon-cyan">${it.optionsCount}</span></p>
               <p class="mt-1 text-white/70">${escapeHtml(it.description)}</p>`,
        actions: [
          { action: "buy", label: `Buy · $${it.cost}`, variant: "go", data: { "item-id": it.id }, disabled: !afford },
        ],
      });
    }
    // voucher
    const afford = run.money >= it.cost;
    return renderDetailSheet({
      title: it.name,
      body: `<p class="text-[11px] uppercase tracking-widest text-neon-gold">Voucher</p>
             <p class="mt-1">${escapeHtml(it.description)}</p>`,
      actions: [
        {
          action: "buy",
          label: `Buy · $${it.cost}`,
          variant: "go",
          data: { "item-id": `voucher:${it.voucherId}` },
          disabled: !afford,
        },
      ],
    });
  }
  if (kind === "consumable") {
    const c = run.consumables.find((x) => x.id === id);
    if (!c) return null;
    return renderDetailSheet({
      title: c.name,
      body: `<p class="text-[11px] uppercase tracking-widest text-neon-gold">${c.kind}</p>
             <p class="mt-1">${escapeHtml(c.description)}</p>`,
      actions: [
        { action: "use-consumable", label: "Use", variant: "go", data: { "instance-id": c.id } },
        { action: "sell-consumable", label: "Sell", variant: "gold", data: { "instance-id": c.id } },
      ],
    });
  }
  if (kind === "voucher") {
    const v = run.vouchers.find((x) => x.id === id);
    if (!v) return null;
    return renderDetailSheet({
      title: v.name,
      body: `<p class="text-[11px] uppercase tracking-widest text-neon-gold">Voucher</p>
             <p class="mt-1">${escapeHtml(v.description)}</p>`,
    });
  }
  if (kind === "tag") {
    const t = run.tags.find((x) => x.id === id);
    if (!t) return null;
    return renderDetailSheet({
      title: t.name,
      body: `<p class="text-[11px] uppercase tracking-widest text-neon-cyan">Tag</p>
             <p class="mt-1">${escapeHtml(t.description)}</p>`,
    });
  }
  return null;
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
