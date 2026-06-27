/** Typed fetch wrappers. Native fetch, same-origin via the Vite proxy. Token passed per call.
 *  Transport (timeout + retry/backoff + net-status state machine) lives in ./net.ts. */

import { request } from "./net.ts";
import type {
  DeckPeekDTO,
  DeckSummary,
  Difficulty,
  PreviewResponse,
  RunStateDTO,
  User,
} from "./types.ts";

// PET-206: credentialed auth. Returning users log in with username + password. New accounts are
// created via signup, which needs an admin-issued invite code (the prealpha gate).
export const login = (username: string, password: string) =>
  request<{ token: string; user: User }>("/api/auth/login", {
    method: "POST",
    body: { username, password },
  });

export const signup = (username: string, password: string, inviteCode: string) =>
  request<{ token: string; user: User }>("/api/auth/signup", {
    method: "POST",
    body: { username, password, inviteCode },
  });

export const me = (token: string) => request<{ user: User }>("/api/auth/me", { token });

/** PET-60: invalidate the current token server-side. 204 No Content (request() tolerates an
 *  empty body). Best-effort — the client clears its token regardless of the outcome. */
export const logout = (token: string) =>
  request<void>("/api/auth/logout", { method: "POST", token });

export const listDecks = (token: string) =>
  request<{ decks: DeckSummary[] }>("/api/decks", { token });

export const activeRun = (token: string) =>
  request<{ run: RunStateDTO | null }>("/api/run/active", { token });

export const startRun = (token: string, difficulty: Difficulty, deckId: string) =>
  request<RunStateDTO>("/api/run", { method: "POST", token, body: { difficulty, deckId } });

export const abandonRun = (token: string) =>
  request<{ run: null }>("/api/run/abandon", { method: "POST", token });

export const startBlind = (token: string) =>
  request<RunStateDTO>("/api/run/blind", { method: "POST", token });

export const playHand = (token: string, ids: string[]) =>
  request<RunStateDTO>("/api/run/play", { method: "POST", token, body: { selectedCardIds: ids } });

export const discardCards = (token: string, ids: string[]) =>
  request<RunStateDTO>("/api/run/discard", { method: "POST", token, body: { selectedCardIds: ids } });

export const previewPlay = (token: string, ids: string[]) =>
  request<PreviewResponse>("/api/run/preview", {
    method: "POST",
    token,
    body: { selectedCardIds: ids },
  });

export const buyItem = (token: string, itemId: string) =>
  request<RunStateDTO>("/api/run/buy", { method: "POST", token, body: { itemId } });

export const rerollShop = (token: string) =>
  request<RunStateDTO>("/api/run/reroll", { method: "POST", token });

export const continueRun = (token: string) =>
  request<RunStateDTO>("/api/run/continue", { method: "POST", token });

export const peekDeck = (token: string) => request<DeckPeekDTO>("/api/run/deck", { token });

export const sellJoker = (token: string, jokerId: string) =>
  request<RunStateDTO>("/api/run/sell", { method: "POST", token, body: { jokerId } });

export const reorderJoker = (token: string, jokerId: string, dir: "left" | "right") =>
  request<RunStateDTO>("/api/run/reorder", { method: "POST", token, body: { jokerId, dir } });

// ---- foundation (PET-67) — wrappers for endpoints content streams will populate ----

export const useConsumable = (token: string, instanceId: string, selectedCardIds?: string[]) =>
  request<RunStateDTO>("/api/run/consumable/use", {
    method: "POST",
    token,
    body: { instanceId, selectedCardIds: selectedCardIds ?? [] },
  });

export const sellConsumable = (token: string, instanceId: string) =>
  request<RunStateDTO>("/api/run/consumable/sell", {
    method: "POST",
    token,
    body: { instanceId },
  });

export const skipBlind = (token: string) =>
  request<RunStateDTO>("/api/run/skip", { method: "POST", token });

// ---- booster pack opener (PET-70) — backend may 400 until PET-70-BE ships --

/** Submit the chosen N items from the currently-opening pack. */
export const pickFromPack = (token: string, itemIds: string[]) =>
  request<RunStateDTO>("/api/run/pack/pick", {
    method: "POST",
    token,
    body: { itemIds },
  });

/** Skip the open pack (forfeit picks, return to shop). */
export const skipPack = (token: string) =>
  request<RunStateDTO>("/api/run/pack/skip", { method: "POST", token });
