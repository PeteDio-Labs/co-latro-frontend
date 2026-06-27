/** Unit tests for the pure render functions in ui.ts (PET-66).
 *  These render → HTML-string functions are easy to assert against directly: smoke that
 *  the screen renders something, the expected data-action hooks are wired, and conditional
 *  branches (boss warning, resume button, sellable jokers) behave. */
import { describe, expect, test } from "vitest";
import {
  renderBlindSelect,
  renderBoard,
  renderNewRunSelect,
  renderMainMenu,
  renderShop,
  renderSignIn,
  renderRunOverlay,
} from "./ui.ts";
import type {
  BossEffect,
  Consumable,
  DeckSummary,
  RunStateDTO,
  User,
} from "./types.ts";

const user: User = { id: "u1", name: "tester" };

function makeRun(overrides: Partial<RunStateDTO> = {}): RunStateDTO {
  const base: RunStateDTO = {
    runId: "r1",
    difficulty: "medium",
    deckId: "standard",
    deckName: "Standard Deck",
    ante: 1,
    maxAnte: 8,
    blindIndex: 0,
    blindKind: "small",
    money: 4,
    handLevels: {
      high_card: 1, pair: 1, two_pair: 1, three_of_a_kind: 1,
      straight: 1, flush: 1, full_house: 1, four_of_a_kind: 1,
      straight_flush: 1, royal_flush: 1,
      five_of_a_kind: 1, flush_house: 1, flush_five: 1,
    },
    jokers: [],
    maxJokers: 5,
    target: 300,
    totalScore: 0,
    hand: [
      { id: "c1", rank: 10, suit: "spades" },
      { id: "c2", rank: 11, suit: "hearts" },
      { id: "c3", rank: 14, suit: "diamonds" },
    ],
    handSize: 8,
    maxSelect: 5,
    handsRemaining: 4,
    discardsRemaining: 3,
    deckRemaining: 49,
    status: "playing",
    lastPlay: null,
    pendingReward: null,
    pendingRewardBreakdown: null,
    shop: null,
    consumables: [],
    maxConsumables: 2,
    vouchers: [],
    tags: [],
    bossEffect: null,
    skipsThisRun: 0,
  };
  return { ...base, ...overrides };
}

describe("renderSignIn", () => {
  test("returns a non-empty string", () => {
    const html = renderSignIn();
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(0);
  });

  test("contains the signin data-action hook", () => {
    expect(renderSignIn()).toContain('data-action="signin"');
  });

  test("contains the username + password input fields (PET-206)", () => {
    const html = renderSignIn();
    expect(html).toContain('id="name-input"');
    expect(html).toContain('id="password-input"');
  });

  test("signup mode shows the invite-code field + create-account hook, prefilled (PET-206)", () => {
    const html = renderSignIn("signup", "abc123");
    expect(html).toContain('id="invite-input"');
    expect(html).toContain('value="abc123"');
    expect(html).toContain('data-action="signup"');
    // login mode (default) does NOT show the invite field
    expect(renderSignIn()).not.toContain('id="invite-input"');
  });
});

describe("renderMainMenu", () => {
  test("renders the operator name (escaped)", () => {
    const html = renderMainMenu(user, null);
    expect(html).toContain("tester");
  });

  test("omits the resume button when there's no active run", () => {
    const html = renderMainMenu(user, null);
    expect(html).not.toContain('data-action="resume"');
    expect(html).toContain('data-action="goto-play"');
  });

  test("shows the resume button when an active run is passed", () => {
    const run = makeRun({ status: "playing" });
    const html = renderMainMenu(user, run);
    expect(html).toContain('data-action="resume"');
    expect(html).toContain("Continue Run");
  });

  test("escapes HTML in the username", () => {
    const naughty: User = { id: "u2", name: "<script>alert(1)</script>" };
    const html = renderMainMenu(naughty, null);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("renderBlindSelect", () => {
  test("renders the start-blind action and target score", () => {
    const html = renderBlindSelect(makeRun({ status: "selecting_blind", target: 300 }));
    expect(html).toContain('data-action="start-blind"');
    expect(html).toContain("300");
  });

  test("boss blinds suppress the skip button and add the danger badge", () => {
    const html = renderBlindSelect(makeRun({ blindKind: "boss", blindIndex: 2 }));
    expect(html).not.toContain('data-action="skip-blind"');
    expect(html).toContain("NO SKIP");
  });

  test("small/big blinds expose skip", () => {
    const html = renderBlindSelect(makeRun({ blindKind: "small" }));
    expect(html).toContain('data-action="skip-blind"');
  });
});

describe("renderBoard", () => {
  test("renders the hand cards with toggle-card hooks", () => {
    const run = makeRun();
    const html = renderBoard(run, new Set(), null);
    expect(html).toContain('data-action="toggle-card"');
    expect(html).toContain('data-card-id="c1"');
    expect(html).toContain('data-card-id="c2"');
    expect(html).toContain('data-card-id="c3"');
  });

  test("Play button is disabled when no cards selected", () => {
    const run = makeRun();
    const html = renderBoard(run, new Set(), null);
    // disabled is rendered as a bare attribute on the play button
    const playButtonMatch = html.match(/<button[^>]*data-action="play"[^>]*>/);
    expect(playButtonMatch).not.toBeNull();
    expect(playButtonMatch![0]).toContain("disabled");
  });

  test("renders selected jokers in the joker row", () => {
    const run = makeRun({
      jokers: [
        { id: "j1", name: "Joker Test", description: "Tests are good", cost: 0, sellValue: 1 },
      ],
    });
    const html = renderBoard(run, new Set(), null);
    expect(html).toContain("Joker Test");
    expect(html).toContain('data-joker-id="j1"');
  });

  test("renders the boss warning banner when bossEffect is set", () => {
    const boss: BossEffect = { id: "b1", name: "The Hook", description: "Discards 2 random cards." };
    const run = makeRun({ blindKind: "boss", bossEffect: boss });
    const html = renderBoard(run, new Set(), null);
    expect(html).toContain("cy-boss-warning");
    expect(html).toContain("The Hook");
  });

  test("omits the boss warning banner when bossEffect is null", () => {
    const run = makeRun();
    const html = renderBoard(run, new Set(), null);
    expect(html).not.toContain("cy-boss-warning");
  });

  test("consumable selection prompt swaps Play/Discard for Confirm/Cancel", () => {
    const consumable: Consumable = {
      id: "cons1",
      defId: "tarot-fool",
      name: "The Fool",
      description: "Pick 1 card",
      kind: "tarot",
      needsSelection: { min: 1, max: 1, from: "hand" },
    };
    const run = makeRun({ consumables: [consumable] });
    const html = renderBoard(run, new Set(["c1"]), null, { instanceId: "cons1", def: consumable });
    expect(html).toContain('data-action="confirm-consumable"');
    expect(html).toContain('data-action="cancel-consumable"');
  });
});

describe("renderShop", () => {
  test("renders continue and reroll actions", () => {
    const run = makeRun({
      status: "shop",
      money: 10,
      shop: { items: [], rerollCost: 5, voucher: null },
    });
    const html = renderShop(run);
    expect(html).toContain('data-action="continue"');
    expect(html).toContain('data-action="reroll"');
  });

  test("disables reroll when the player can't afford it", () => {
    const run = makeRun({
      status: "shop",
      money: 0,
      shop: { items: [], rerollCost: 5, voucher: null },
    });
    const html = renderShop(run);
    const rerollMatch = html.match(/<button[^>]*data-action="reroll"[^>]*>/);
    expect(rerollMatch).not.toBeNull();
    expect(rerollMatch![0]).toContain("disabled");
  });
});

describe("renderNewRunSelect", () => {
  const decks: DeckSummary[] = [
    { id: "d1", name: "Standard", description: "Vanilla", perk: {}, size: 52 },
    { id: "d2", name: "Red", description: "Plus hand", perk: { extraHands: 1 }, size: 52 },
  ];

  test("shows only the selected deck, with prev/next carousel arrows", () => {
    const html = renderNewRunSelect(decks, "d1", "easy");
    expect(html).toContain("Standard");
    expect(html).not.toContain("Red"); // carousel shows ONE deck at a time
    expect(html).toContain('data-action="deck-prev"');
    expect(html).toContain('data-action="deck-next"');
    expect(html).toContain("Deck 1 / 2");
  });

  test("offers all three difficulties and a start-run action", () => {
    const html = renderNewRunSelect(decks, "d1", "easy");
    expect(html).toContain('data-difficulty="easy"');
    expect(html).toContain('data-difficulty="medium"');
    expect(html).toContain('data-difficulty="hard"');
    expect(html).toContain('data-action="start-run"');
  });
});

describe("renderRunOverlay", () => {
  test("won_run shows the victory copy", () => {
    const run = makeRun({ status: "won_run" });
    const html = renderRunOverlay(run);
    expect(html).toContain("RUN COMPLETE");
  });

  test("lost_run shows the game-over copy", () => {
    const run = makeRun({ status: "lost_run" });
    const html = renderRunOverlay(run);
    expect(html).toContain("GAME OVER");
  });
});
