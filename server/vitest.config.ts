import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/test-helpers/**",
        "src/__tests__/**",
        "src/db/migrations/**",
        "src/mastra/public/**",
        "src/index.ts",
        "src/env.d.ts",
      ],
      thresholds: {
        branches: 70,
        lines: 78,
        functions: 76,
        statements: 77,
      },
    },
  },
});
