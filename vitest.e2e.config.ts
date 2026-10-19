import { defineConfig } from "vitest/config";

// End-to-end tests run the built CLI from dist/; `npm run e2e` builds first.
export default defineConfig({
  test: {
    include: ["e2e/**/*.test.ts"],
  },
});
