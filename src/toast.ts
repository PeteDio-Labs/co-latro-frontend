/** Tiny neon-themed toast manager — replaces blocking alert() for transient errors / info.
 *  Toasts live in a fixed container appended once to <body>; they survive #app re-renders
 *  (main.ts rebuilds #app.innerHTML on every state change). Stacks up to MAX_VISIBLE; older
 *  toasts get evicted as new ones arrive. Auto-dismiss: 4s (info/success) or 6s (error). */

export type ToastKind = "error" | "info" | "success";

const MAX_VISIBLE = 3;
const TTL_MS: Record<ToastKind, number> = { error: 6000, info: 4000, success: 4000 };

interface ToastEntry {
  id: number;
  el: HTMLDivElement;
  timer: number;
}

let container: HTMLDivElement | null = null;
const live: ToastEntry[] = [];
let nextId = 1;

function ensureContainer(): HTMLDivElement {
  if (container) return container;
  const el = document.createElement("div");
  el.id = "cy-toast-root";
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-atomic", "false");
  // fixed top-right stack; safe-area-aware so iOS notch doesn't clip it
  el.className =
    "fixed z-[100] flex flex-col gap-2 pointer-events-none top-[max(16px,env(safe-area-inset-top))] right-[max(16px,env(safe-area-inset-right))] left-[max(16px,env(safe-area-inset-left))] sm:left-auto sm:max-w-sm";
  document.body.appendChild(el);
  container = el;
  return el;
}

function dismiss(entry: ToastEntry): void {
  const idx = live.indexOf(entry);
  if (idx === -1) return;
  live.splice(idx, 1);
  window.clearTimeout(entry.timer);
  entry.el.style.opacity = "0";
  entry.el.style.transform = "translateX(8px)";
  window.setTimeout(() => entry.el.remove(), 180);
}

export function showToast(message: string, kind: ToastKind = "info"): void {
  const root = ensureContainer();
  // Evict the oldest if we'd exceed the cap.
  while (live.length >= MAX_VISIBLE) {
    const oldest = live[0];
    if (oldest) dismiss(oldest);
    else break;
  }
  const el = document.createElement("div");
  // pointer-events-auto on the toast itself so users can tap to dismiss
  el.className = `cy-toast cy-toast--${kind} pointer-events-auto`;
  el.setAttribute("role", kind === "error" ? "alert" : "status");
  el.textContent = message;

  const id = nextId++;
  const entry: ToastEntry = {
    id,
    el,
    timer: window.setTimeout(() => dismiss(entry), TTL_MS[kind]),
  };
  el.addEventListener("click", () => dismiss(entry));
  live.push(entry);
  root.appendChild(el);
  // mount transition: small slide-in
  requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateX(0)";
  });
}
