/** Typed fetch wrappers. Native fetch, same-origin via the Vite proxy. Token passed per call. */

import type {
  DeckPeekDTO,
  DeckSummary,
  Difficulty,
  PreviewResponse,
  RunStateDTO,
  User,
} from "./types.ts";

interface RequestError extends Error {
  status?: number;
}

async function request<T>(
  url: string,
  opts: { method?: string; token?: string | null; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    const err: RequestError = new Error(data?.message ?? `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}

export const login = (name: string) =>
  request<{ token: string; user: User }>("/api/auth/login", { method: "POST", body: { name } });

export const me = (token: string) => request<{ user: User }>("/api/auth/me", { token });

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
