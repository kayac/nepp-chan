import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.ts"],
      // loader-entry は document.currentScript 依存の bootstrap shell
      exclude: ["src/**/*.test.ts", "src/loader-entry.ts"],
      reporter: ["text", "json-summary", "json"],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 98,
        lines: 98,
      },
    },
  },
});
