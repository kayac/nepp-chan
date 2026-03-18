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
  },
});
