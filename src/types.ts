/** Client-side mirror of the backend DTO shapes. */

export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
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

export type ShopItem = PlanetShopItem | JokerShopItem;

export interface ShopState {
  items: ShopItem[];
  rerollCost: number;
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
