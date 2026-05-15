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
        "src/__tests__/**",
        "src/__mocks__/**",
        "src/db/migrations/**",
        "src/index.ts",
        "src/env.d.ts",
      ],
      thresholds: {
        branches: 86,
        lines: 95,
        functions: 95,
        statements: 95,
      },
    },
  },
});
