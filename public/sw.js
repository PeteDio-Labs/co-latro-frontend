/* Co-latro — vanilla service worker (PET-63).
 *
 * Goal: offline-capable app *shell* + cache-first hashed assets, so the UI loads
 * instantly on repeat visits and at least renders when the network is down.
 * Gameplay stays online — the backend is authoritative and /api is NEVER
 * intercepted (we let nginx in prod / vite proxy in dev pass it straight through).
 *
 * Versioning: this file is served verbatim from public/ — Vite doesn't process it,
 * so we can't read import.meta.env here. Bump CACHE_VERSION by hand on release;
 * the activate handler will purge stale caches keyed by the old version.
 *
 * Strategies:
 *   - app shell (install)  → precache index.html, manifest, icon
 *   - /assets/* (hashed)   → cache-first, immutable (Vite emits content-hashed names)
 *   - navigations          → network-first, fall back to cached index.html
 *   - /api/*               → passthrough (never touched)
 *   - everything else      → network, opportunistically cached on success
 *
 * Failures degrade gracefully: every cache op is wrapped so a SW bug can't break
 * the page — the fetch always resolves to *something* (network or cache or final
 * network attempt).
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `colatro-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `colatro-assets-${CACHE_VERSION}`;
const RUNTIME_CACHE = `colatro-runtime-${CACHE_VERSION}`;

const SHELL_URLS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(SHELL_CACHE);
        await cache.addAll(SHELL_URLS);
      } catch (err) {
        // Precache failure shouldn't block install — the runtime handlers will
        // still cache opportunistically on first fetch.
        console.warn("[sw] shell precache failed:", err);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keep = new Set([SHELL_CACHE, ASSET_CACHE, RUNTIME_CACHE]);
        const names = await caches.keys();
        await Promise.all(
          names
            .filter((name) => name.startsWith("colatro-") && !keep.has(name))
            .map((name) => caches.delete(name)),
        );
      } catch (err) {
        console.warn("[sw] activate cleanup failed:", err);
      }
      await self.clients.claim();
    })(),
  );
});

/** Safe cache.match — never throws into the fetch pipeline. */
async function safeMatch(cacheName, request) {
  try {
    const cache = await caches.open(cacheName);
    return await cache.match(request);
  } catch (err) {
    console.warn("[sw] cache match failed:", err);
    return undefined;
  }
}

/** Safe cache.put — clones response, swallows errors so callers can return original. */
async function safePut(cacheName, request, response) {
  try {
    if (!response || !response.ok || response.type === "opaque") return;
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch (err) {
    console.warn("[sw] cache put failed:", err);
  }
}

/** Cache-first: hashed, immutable assets — serve from cache, only hit network on miss. */
async function cacheFirst(request) {
  const cached = await safeMatch(ASSET_CACHE, request);
  if (cached) return cached;
  const response = await fetch(request);
  await safePut(ASSET_CACHE, request, response);
  return response;
}

/** Network-first navigation: try fresh HTML, fall back to shell cache when offline. */
async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    await safePut(SHELL_CACHE, "/index.html", response);
    return response;
  } catch {
    const cached =
      (await safeMatch(SHELL_CACHE, request)) ??
      (await safeMatch(SHELL_CACHE, "/index.html")) ??
      (await safeMatch(SHELL_CACHE, "/"));
    if (cached) return cached;
    // Last resort: a minimal offline body so the browser doesn't show its own error chrome.
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Offline</title><p>Offline — reconnect to load Co-latro.</p>",
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
    );
  }
}

/** Stale-while-revalidate-ish for misc same-origin GETs (manifest, icon, fonts via CDN don't qualify). */
async function runtimeHandler(request) {
  const cached = await safeMatch(RUNTIME_CACHE, request);
  if (cached) {
    // Refresh in the background; ignore failures.
    fetch(request)
      .then((response) => safePut(RUNTIME_CACHE, request, response))
      .catch(() => undefined);
    return cached;
  }
  const response = await fetch(request);
  await safePut(RUNTIME_CACHE, request, response);
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // SW spec: only GETs are cacheable. Everything else (POST/PATCH/DELETE for /api) passes through.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Same-origin only. Cross-origin (Google Fonts, etc.) → browser handles directly.
  if (url.origin !== self.location.origin) return;

  // Backend passthrough — gameplay is authoritative on the server, never cache it.
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests → network-first with cached shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Hashed build assets — cache-first (Vite content-hashes these so cache busting is automatic).
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Manifest + icon + other static files — runtime cache.
  if (url.pathname === "/manifest.webmanifest" || url.pathname === "/icon.svg") {
    event.respondWith(runtimeHandler(request));
    return;
  }

  // Everything else: try network, fall back to whatever we have cached anywhere.
  event.respondWith(
    fetch(request).catch(async () => {
      const cached =
        (await safeMatch(RUNTIME_CACHE, request)) ??
        (await safeMatch(ASSET_CACHE, request)) ??
        (await safeMatch(SHELL_CACHE, request));
      if (cached) return cached;
      throw new Error("offline and uncached");
    }),
  );
});
