import { defineConfig } from "vitest/config";

// End-to-end tests run the built CLI from dist/; `npm run e2e` builds first.
// Each test spawns the CLI, which spawns git, so allow more than the default 5 s.
export default defineConfig({
  test: {
    include: ["e2e/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
