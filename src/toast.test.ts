/** Unit tests for the toast manager (PET-66).
 *  Asserts DOM-mount semantics + auto-dismiss timing under vi's fake timers.
 *  toast.ts holds module-scope state (container ref + live entries) so we re-import
 *  via vi.resetModules() between tests for clean isolation. */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

beforeEach(async () => {
  document.body.innerHTML = "";
  vi.useFakeTimers();
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("showToast", () => {
  test("appends a toast root + the toast node to the body", async () => {
    const { showToast } = await import("./toast.ts");
    showToast("hello", "info");
    const root = document.getElementById("cy-toast-root");
    expect(root).not.toBeNull();
    expect(root!.querySelectorAll(".cy-toast").length).toBe(1);
    expect(root!.querySelector(".cy-toast")!.textContent).toBe("hello");
  });

  test("info toasts auto-dismiss at the info TTL (4s)", async () => {
    const { showToast } = await import("./toast.ts");
    showToast("ping", "info");
    const root = document.getElementById("cy-toast-root")!;
    expect(root.querySelectorAll(".cy-toast").length).toBe(1);
    // dismiss schedules removal at TTL + 180ms transition
    vi.advanceTimersByTime(4000);
    vi.advanceTimersByTime(200);
    expect(root.querySelectorAll(".cy-toast").length).toBe(0);
  });

  test("error toasts use a longer TTL than info (6s vs 4s)", async () => {
    const { showToast } = await import("./toast.ts");
    showToast("oops", "error");
    const root = document.getElementById("cy-toast-root")!;
    // At t=4.2s the error toast is still alive (info would already be gone).
    vi.advanceTimersByTime(4200);
    expect(root.querySelectorAll(".cy-toast").length).toBe(1);
    // At t=6.2s+ it's gone.
    vi.advanceTimersByTime(2000);
    expect(root.querySelectorAll(".cy-toast").length).toBe(0);
  });

  test("evicts the oldest toast once MAX_VISIBLE is exceeded", async () => {
    const { showToast } = await import("./toast.ts");
    showToast("one", "info");
    showToast("two", "info");
    showToast("three", "info");
    const root = document.getElementById("cy-toast-root")!;
    expect(root.querySelectorAll(".cy-toast").length).toBe(3);
    showToast("four", "info");
    // The fourth toast evicts "one" (oldest). At the moment of eviction the node is
    // still in the DOM during the 180ms transition; flush it forward.
    vi.advanceTimersByTime(200);
    const texts = [...root.querySelectorAll(".cy-toast")].map((el) => el.textContent);
    expect(texts).not.toContain("one");
    expect(texts).toContain("two");
    expect(texts).toContain("three");
    expect(texts).toContain("four");
  });

  test("clicking a toast dismisses it early", async () => {
    const { showToast } = await import("./toast.ts");
    showToast("tap me", "info");
    const root = document.getElementById("cy-toast-root")!;
    const node = root.querySelector<HTMLDivElement>(".cy-toast")!;
    node.click();
    vi.advanceTimersByTime(200);
    expect(root.querySelectorAll(".cy-toast").length).toBe(0);
  });
});
