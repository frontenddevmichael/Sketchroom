import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["convex/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 30000,
    environmentMatchGlobs: [
      ["convex/**/*.test.ts", "edge-runtime"],
      ["src/**/*.test.ts", "node"],
    ],
  },
});
