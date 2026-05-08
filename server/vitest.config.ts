import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@sentry/cloudflare": new URL(
        "./src/__mocks__/@sentry/cloudflare.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    globals: true,
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/test-helpers/**",
        "src/__mocks__/**",
        "src/__tests__/**",
        "src/db/migrations/**",
        "src/index.ts",
        "src/env.d.ts",
      ],
      thresholds: {
        branches: 28,
        lines: 42,
        functions: 32,
        statements: 41,
      },
    },
  },
});
