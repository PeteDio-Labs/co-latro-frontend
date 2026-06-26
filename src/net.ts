/** Network resilience (PET-62).
 *
 *  Wraps fetch with:
 *  - per-request timeout via AbortController (default 8s),
 *  - retry-with-backoff on idempotent GETs only (network error / timeout, not 4xx/5xx),
 *  - a tiny pub-sub "net status" state machine (online → retrying → offline → online),
 *  - a persistent offline banner mounted to <body> that reuses the .cy-statusbar tokens.
 *
 *  Non-GET methods (POST/PUT/DELETE) never retry — they may not be idempotent. They still
 *  participate in status (a network failure flips the status to "retrying"/"offline") so the
 *  banner appears, but the caller gets the error rethrown immediately to handle as before. */

export type NetStatus = "online" | "retrying" | "offline";

const DEFAULT_TIMEOUT_MS = 8000;
const RETRY_BACKOFF_MS = [400, 1200] as const; // attempts 2 and 3 (first try has no delay)

// ---- state ----------------------------------------------------------------

let status: NetStatus = "online";
const listeners = new Set<(s: NetStatus) => void>();

export function getNetStatus(): NetStatus {
  return status;
}

export function subscribeNet(fn: (s: NetStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setStatus(next: NetStatus): void {
  if (next === status) return;
  status = next;
  updateBanner();
  for (const fn of listeners) fn(next);
}

// ---- banner ---------------------------------------------------------------

let bannerEl: HTMLDivElement | null = null;
let manualRetryHandler: (() => void) | null = null;

/** Caller (main.ts) registers a "try a recovery fetch now" hook. The banner click in
 *  the "offline" state triggers it; on success the status flips back to "online". */
export function setManualRetryHandler(fn: () => void): void {
  manualRetryHandler = fn;
}

// ---- unauthorized (401) handler (PET-60) ----------------------------------

let unauthorizedHandler: (() => void) | null = null;

/** main.ts registers what to do when the server rejects our token (401): clear the stored
 *  token and drop back to sign-in. Fired once per 401 response, before the error is rethrown
 *  so existing per-call catches still run (they'll just show a toast over the sign-in screen). */
export function setUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn;
}

function ensureBanner(): HTMLDivElement {
  if (bannerEl) return bannerEl;
  const el = document.createElement("div");
  el.id = "cy-net-banner";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.className =
    "cy-statusbar cy-statusbar--top cy-net-banner";
  el.style.position = "fixed";
  el.style.top = "0";
  el.style.left = "0";
  el.style.right = "0";
  el.style.zIndex = "90";
  el.style.display = "none";
  el.addEventListener("click", () => {
    if (status === "offline" && manualRetryHandler) manualRetryHandler();
  });
  // Append on first call — defer until DOM is ready.
  if (document.body) document.body.appendChild(el);
  else document.addEventListener("DOMContentLoaded", () => document.body.appendChild(el), { once: true });
  bannerEl = el;
  return el;
}

function updateBanner(): void {
  const el = ensureBanner();
  el.classList.remove("cy-statusbar--retrying", "cy-statusbar--offline");
  if (status === "online") {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.style.display = "flex";
  if (status === "retrying") {
    el.classList.add("cy-statusbar--retrying");
    el.textContent = "CONNECTION LOST · RETRYING";
  } else {
    el.classList.add("cy-statusbar--offline");
    el.textContent = "OFFLINE · TAP TO RETRY";
  }
}

// ---- request --------------------------------------------------------------

interface RequestError extends Error {
  status?: number;
}

export interface RequestOpts {
  method?: string;
  token?: string | null;
  body?: unknown;
  /** Override the 8s default. */
  timeoutMs?: number;
}

/** True for network-layer failures we should consider retrying on idempotent GETs.
 *  - TypeError: fetch couldn't reach the server (DNS / offline / CORS-before-response).
 *  - AbortError: our own timeout fired. */
function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof DOMException && err.name === "AbortError") return true;
  return false;
}

async function fetchOnce(url: string, opts: RequestOpts, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  try {
    return await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

export async function request<T>(url: string, opts: RequestOpts = {}): Promise<T> {
  const method = (opts.method ?? "GET").toUpperCase();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const idempotent = method === "GET";
  const maxAttempts = idempotent ? 1 + RETRY_BACKOFF_MS.length : 1;

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await fetchOnce(url, opts, timeoutMs);
      if (!res.ok) {
        // Server replied — not a network error. Bubble up like before, mark online.
        if (status !== "online") setStatus("online");
        const data = (await res.json().catch(() => null)) as { message?: string } | null;
        const err: RequestError = new Error(data?.message ?? `Request failed (${res.status})`);
        err.status = res.status;
        // PET-60: an authenticated request rejected with 401 means our token is dead (expired,
        // logged out, or invalid). Notify the app to clear it + re-login. Guarded on opts.token
        // so the unauthenticated login call can never trigger a re-login loop.
        if (res.status === 401 && opts.token && unauthorizedHandler) unauthorizedHandler();
        throw err;
      }
      // Success — clear any retrying/offline state.
      if (status !== "online") setStatus("online");
      // 204 No Content (or any empty body, e.g. logout) → resolve with undefined rather than
      // letting res.json() throw on the empty payload.
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (!isNetworkError(err)) throw err; // server error / parse error — don't retry
      // Network failure path.
      const isLastAttempt = attempt === maxAttempts - 1;
      if (!idempotent) {
        // Non-GET: surface the failure so the user can re-press the button.
        // Flip status so the banner appears, but don't retry.
        if (status === "online") setStatus("retrying");
        throw err;
      }
      if (isLastAttempt) {
        setStatus("offline");
        throw err;
      }
      setStatus("retrying");
      await delay(RETRY_BACKOFF_MS[attempt]!);
    }
  }
  // Unreachable — loop either returns or throws — but keep TS happy.
  throw lastErr ?? new Error("request failed");
}
