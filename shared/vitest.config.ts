import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "json-summary"],
      include: ["src/api/**/*.ts"],
      exclude: ["src/api/**/*.test.ts", "src/api/**/*.d.ts", "src/test/**"],
      thresholds: {
        branches: 70,
        lines: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
