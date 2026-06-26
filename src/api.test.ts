/** Unit tests for the typed fetch wrappers in api.ts (PET-66).
 *  Stubs globalThis.fetch so we can assert URLs, headers, bodies, and error mapping
 *  without standing up the backend. */
import { afterEach, describe, expect, test, vi } from "vitest";
import * as api from "./api.ts";
import { setUnauthorizedHandler } from "./net.ts";

function jsonResponse(data: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  setUnauthorizedHandler(() => {}); // reset any handler a test installed
});

describe("api.login", () => {
  test("POSTs to /api/auth/login with a JSON body", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ token: "tk", user: { id: "u1", name: "tester" } }),
    );
    const result = await api.login("tester");
    expect(result.token).toBe("tk");
    expect(result.user.name).toBe("tester");
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, opts] = spy.mock.calls[0]!;
    expect(url).toBe("/api/auth/login");
    expect((opts as RequestInit).method).toBe("POST");
    const headers = (opts as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect((opts as RequestInit).body).toBe(JSON.stringify({ name: "tester" }));
  });
});

describe("api.me", () => {
  test("GETs /api/auth/me with the bearer token", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ user: { id: "u1", name: "tester" } }),
    );
    await api.me("tk");
    const [url, opts] = spy.mock.calls[0]!;
    expect(url).toBe("/api/auth/me");
    expect((opts as RequestInit).method).toBe("GET");
    const headers = (opts as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer tk");
  });
});

describe("api.playHand", () => {
  test("POSTs selectedCardIds to /api/run/play", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ runId: "r1" }));
    await api.playHand("tk", ["c1", "c2"]);
    const [url, opts] = spy.mock.calls[0]!;
    expect(url).toBe("/api/run/play");
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body).toEqual({ selectedCardIds: ["c1", "c2"] });
  });
});

describe("api error mapping", () => {
  test("throws an Error with the server's message + status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "bad token" }, { status: 401 }),
    );
    await expect(api.me("tk")).rejects.toThrow("bad token");
  });

  test("falls back to a default message when the response isn't JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("not json", { status: 500 }),
    );
    await expect(api.me("tk")).rejects.toThrow(/Request failed/);
  });
});

describe("api.startRun", () => {
  test("POSTs difficulty + deckId", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ runId: "r1" }));
    await api.startRun("tk", "hard", "standard");
    const [, opts] = spy.mock.calls[0]!;
    const body = JSON.parse((opts as RequestInit).body as string);
    expect(body).toEqual({ difficulty: "hard", deckId: "standard" });
  });
});

describe("api.logout (PET-60)", () => {
  test("POSTs /api/auth/logout with the bearer token and resolves on 204", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.logout("tk")).resolves.toBeUndefined(); // 204 → no JSON body, no throw
    const [url, opts] = spy.mock.calls[0]!;
    expect(url).toBe("/api/auth/logout");
    expect((opts as RequestInit).method).toBe("POST");
    const headers = (opts as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer tk");
  });
});

describe("401 → unauthorized handler (PET-60)", () => {
  test("fires the handler when an authenticated request is rejected with 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "token_expired", message: "Session expired" }, { status: 401 }),
    );
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(api.me("dead-token")).rejects.toThrow("Session expired"); // still rethrows
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test("does NOT fire on a 401 from the unauthenticated login call (no token sent)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "nope" }, { status: 401 }),
    );
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(api.login("x")).rejects.toThrow();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  test("does NOT fire on non-401 errors (e.g. 400/429)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ message: "rate limited" }, { status: 429 }),
    );
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(api.me("tk")).rejects.toThrow("rate limited");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
