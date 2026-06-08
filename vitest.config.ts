/** Vitest config — jsdom DOM env for pure render-fn + DOM-mutating tests.
 *  Co-located test files (src/*.test.ts) match the backend pattern. */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
