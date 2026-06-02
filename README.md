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

A static build (`bun run build` → `dist/`) served by any static host or container. Serve it behind the same
origin as the backend `/api`, or repoint the proxy/base URL at the deployed API. Pipeline config lives with
the CI workflow.
