import { defineConfig } from "vitest/config";

// Unit tests sit next to the code they cover. The explicit include keeps vitest
// away from the harness's own node:test suite in tests/. Collector tests build
// fixture repositories with real git processes, which are slow on Windows and
// under parallel load, so the default 5 s timeout is too tight.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
