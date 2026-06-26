# Co-latro — Frontend

The browser client for **Co-latro**, a neon Cyber-HUD roguelike poker game. A **"Cyber HUD"** look
(Orbitron + Chakra Petch, scanline grid, clipped neon panels), fully **responsive** (desktop · tablet ·
mobile, both orientations) and **installable as a PWA**. It talks to **co-latro-backend** through a
same-origin `/api` proxy — no game logic lives here.

**Stack:** Vite · vanilla TypeScript · Tailwind v4.

## Run it

Requires [Bun](https://bun.sh) and the backend running on `:3020`.

```bash
bun install
bun run dev        # http://localhost:5173 (also on your LAN — host: true) → proxies /api to :3020
```

```bash
bun run build      # tsc --noEmit && vite build  → dist/
bun run typecheck
```

## Tests

Two layers (PET-66):

- **Vitest unit tests** (`src/*.test.ts`) — pure render functions (`ui.ts`), the fetch wrappers
  (`api.ts`) with `vi.spyOn(globalThis, 'fetch')`, and the toast manager's DOM mount + auto-dismiss
  timing under fake timers. Runs in jsdom; configured in `vitest.config.ts`.
  ```bash
  bun run test        # one-shot
  bun run test:watch  # interactive
  ```
  CI gate: this runs on every PR via `.github/workflows/ci.yml`.

- **Playwright E2E smoke** (`e2e/smoke.spec.ts`) — sign-in → start run → play a hand → reach the
  shop, against the docker-compose stack at `http://localhost:8080` (override with
  `E2E_BASE_URL=...`).
  ```bash
  bun install                                    # node_modules incl. @playwright/test
  bun run build                                  # nginx serves dist/, so build first
  docker compose -f e2e/stack/docker-compose.yml up -d

  # Run the smoke inside the official Playwright image (browsers + system deps baked in —
  # no `playwright install --with-deps`, which needs sudo). Match the tag to @playwright/test.
  docker run --rm --network host --ipc=host \
    -e E2E_BASE_URL=http://localhost:8080 -v "$PWD":/work -w /work \
    mcr.microsoft.com/playwright:v1.60.0-jammy \
    npx playwright test --config e2e/playwright.config.ts

  docker compose -f e2e/stack/docker-compose.yml down -v
  ```
  Or, if you already have chromium + its runtime libs locally, just `bun run e2e` against the
  running stack. The stack (`e2e/stack/docker-compose.yml`) is ephemeral Postgres + the backend
  image + nginx serving `dist/` and proxying `/api` — the same same-origin shape as production.
  The backend image defaults to the Nexus-published `:latest`; set `BACKEND_IMAGE` to a
  locally-built tag to run off the network.
  CI gate (PET-98): the `e2e` job in `.github/workflows/ci.yml` stands this stack up on the
  homelab runner and runs the smoke (in the Playwright container) on every PR.

## What's here

- **Screens** — pure render functions → HTML strings, event-delegated via `data-action`: sign-in, menu,
  deck select, difficulty, blind select, board, played-hand **score animation**, shop, deck peek, run end,
  plus a styled overwrite-confirm modal.
- **Theme** — role-based palette (cyan chips · pink mult · violet frame · **gold** money · **lime**
  go/gains) in `styles.css`: `@theme` tokens + `.cy-*` component classes (clip-paths, scanlines,
  RGB-split title), with a boss-blind danger tint.
- **Responsive + iOS** — fluid `clamp()` sizing plus breakpoint/orientation reflow; `safe-area-inset`
  handling and PWA metas (`viewport-fit=cover`, standalone) so **Add to Home Screen** runs full-screen and
  chrome-less.
- **No deck leakage** — the client only knows what the server's DTO exposes.
- **Service worker** — `public/sw.js` precaches the app shell + cache-firsts hashed `/assets/*` for
  fast loads and an offline shell; gameplay stays online via `/api/*` passthrough (never intercepted).

## Layout

```
index.html              fonts, PWA metas, #app mount
public/                 manifest.webmanifest, icon.svg, design mockups (*-pack.html)
src/
├─ types.ts             client mirror of backend DTOs
├─ api.ts               typed fetch wrappers (native fetch)
├─ ui.ts                render functions (Cyber HUD, responsive)
├─ main.ts              client state + router + score animation + event delegation
└─ styles.css           Tailwind v4 @theme + Cyber HUD component layer
vite.config.ts          /api → :3020 proxy, host: true (LAN)
```

## Deploy / CI

A static build (`bun run build` → `dist/`). Every API call is **relative** (`/api/...`), so it must be
served **same-origin** with the backend — `deploy/nginx.conf` (for the poker-api VM) serves `dist/` and
reverse-proxies `/api` → `http://127.0.0.1:3020`.

CI (`.github/workflows/ci.yml`, Workflow A on the self-hosted homelab runner): **PR** → typecheck + build;
**merge to `main`** → build + upload `dist/` to the MinIO bucket `co-latro-frontend` via `scripts/deploy.sh`
(nginx serves the bucket contents on the VM).
