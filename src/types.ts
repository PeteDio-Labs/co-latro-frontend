/** Client-side mirror of the backend DTO shapes. */

export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/** Foundation modifier scaffolding (PET-67). Content streams (PET-75) populate the catalogs. */
export type Enhancement =
  | "bonus"
  | "mult"
  | "wild"
  | "glass"
  | "steel"
  | "stone"
  | "gold"
  | "lucky";
export type Edition = "foil" | "holo" | "poly" | "negative";
export type Seal = "red" | "blue" | "gold" | "purple";

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  /** Optional modifiers — undefined until PET-75 content lands. */
  enhancement?: Enhancement;
  edition?: Edition;
  seal?: Seal;
}

/** Selection requirement for consumables that need the player to pick targets before use.
 *  Optional — when absent on the DTO (e.g. backend pre-PET-71-BE), the FE treats the consumable
 *  as fire-immediately. `from` declares the source pool (board hand vs owned jokers). */
export interface ConsumableSelection {
  min: number;
  max: number;
  from: "hand" | "owned_jokers";
}

/** A consumable (tarot/planet/spectral) the player owns or is offered. */
export interface Consumable {
  id: string;
  defId: string;
  name: string;
  description: string;
  kind: "tarot" | "planet" | "spectral";
  /** When present + min > 0, using opens selection mode. Null/undefined → fire immediately. */
  needsSelection?: ConsumableSelection | null;
}

/** A purchased voucher applying a run-long modifier. */
export interface Voucher {
  id: string;
  name: string;
  description: string;
}

/** A skip-blind tag carried into the next blind. */
export interface Tag {
  id: string;
  name: string;
  description: string;
}

/** A boss-blind modifier active on the current blind. */
export interface BossEffect {
  id: string;
  name: string;
  description: string;
}

export type Difficulty = "easy" | "medium" | "hard";
export type RunStatus = "selecting_blind" | "playing" | "shop" | "won_run" | "lost_run";
export type BlindKind = "small" | "big" | "boss";

export type HandType =
  | "high_card"
  | "pair"
  | "two_pair"
  | "three_of_a_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_of_a_kind"
  | "straight_flush"
  | "royal_flush";

export type HandLevels = Record<HandType, number>;

export interface JokerStep {
  jokerId: string;
  name: string;
  deltaChips?: number;
  deltaMult?: number;
  xMult?: number;
}

export interface ScoreBreakdown {
  handType: HandType;
  handLabel: string;
  handLevel: number;
  baseChips: number;
  baseMult: number;
  scoringCardIds: string[];
  scoringChips: number;
  totalChips: number;
  score: number;
  jokerSteps: JokerStep[];
}

export interface JokerView {
  id: string;
  name: string;
  description: string;
  cost: number;
  sellValue: number;
}

export interface PlayResult {
  playedCardIds: string[];
  breakdown: ScoreBreakdown;
}

export interface User {
  id: string;
  name: string;
}

export interface DeckPerk {
  extraHands?: number;
  extraDiscards?: number;
  startMoney?: number;
}

export interface DeckSummary {
  id: string;
  name: string;
  description: string;
  perk: DeckPerk;
  size: number;
}

export interface PlanetShopItem {
  id: string;
  kind: "planet";
  planet: string;
  hand: HandType;
  name: string;
  cost: number;
  addChips: number;
  addMult: number;
  targetLevel: number;
}

export interface JokerShopItem {
  id: string;
  kind: "joker";
  jokerId: string;
  name: string;
  description: string;
  cost: number;
  rarity: "common" | "uncommon" | "rare";
}

export interface ConsumableShopItem {
  id: string;
  kind: "consumable";
  defId: string;
  consumableKind: "tarot" | "planet" | "spectral";
  name: string;
  description: string;
  cost: number;
}

export interface VoucherShopItem {
  id: string;
  kind: "voucher";
  voucherId: string;
  name: string;
  description: string;
  cost: number;
}

export type ShopItem = PlanetShopItem | JokerShopItem | ConsumableShopItem | VoucherShopItem;

export interface ShopState {
  items: ShopItem[];
  rerollCost: number;
  /** Optional single voucher slot offered alongside the items grid (PET-67 mirror). */
  voucher?: VoucherShopItem | null;
}

export interface RunStateDTO {
  runId: string;
  difficulty: Difficulty;
  deckId: string;
  deckName: string;
  ante: number;
  maxAnte: number;
  blindIndex: number;
  blindKind: BlindKind;
  money: number;
  handLevels: HandLevels;
  jokers: JokerView[];
  maxJokers: number;
  target: number;
  totalScore: number;
  hand: Card[];
  handSize: number;
  maxSelect: number;
  handsRemaining: number;
  discardsRemaining: number;
  deckRemaining: number;
  status: RunStatus;
  lastPlay: PlayResult | null;
  pendingReward: number | null;
  shop: ShopState | null;
  /** Foundation extensions (PET-67). Default to empty so existing runs keep working. */
  consumables: Consumable[];
  maxConsumables: number;
  vouchers: Voucher[];
  tags: Tag[];
  bossEffect: BossEffect | null;
  skipsThisRun: number;
}

export interface PreviewResponse extends RunStateDTO {
  preview: ScoreBreakdown | null;
}

export interface GroupedFaces {
  byRank: Record<string, number>;
  bySuit: Record<string, number>;
  total: number;
  faces: { code: string; rank: Rank; suit: Suit; count: number }[];
}

export interface DeckPeekDTO {
  remaining: GroupedFaces;
  composition: GroupedFaces;
}
