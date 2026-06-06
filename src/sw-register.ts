/** Service worker registration (PET-63).
 *
 * Registers /sw.js on window.load — but ONLY when we're being served by a
 * production-like origin (nginx in docker on :8080, real deploy on :80/:443).
 * We deliberately skip the Vite dev server (:5173) because the SW would cache
 * the wrong stale dist between hot rebuilds and break the dev loop.
 *
 * Gate: SW available + not on the vite dev port. (We can't just check
 * location.hostname — testing the docker stack on localhost:8080 is a valid
 * production-like target.)
 */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (window.location.port === "5173") return; // Vite dev server — never register.

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Registration failures are non-fatal: the app works without it, just no offline shell.
      console.warn("[sw] registration failed:", err);
    });
  });
}
