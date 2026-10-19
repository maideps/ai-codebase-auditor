import { defineConfig } from "vitest/config";

// Unit tests sit next to the code they cover. The explicit include keeps vitest
// away from the harness's own node:test suite in tests/.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
