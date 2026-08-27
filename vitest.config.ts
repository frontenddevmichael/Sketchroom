import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["convex/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 30000,
    environmentMatchGlobs: [
      ["convex/**/*.test.ts", "edge-runtime"],
      ["src/**/*.test.ts", "node"],
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
