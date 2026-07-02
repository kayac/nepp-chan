import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        // document.currentScript 依存の bootstrap shell
        "src/loader-entry.ts",
        // #root 取得 + createRoot でのマウントのみの bootstrap shell
        "src/iframe-entry.tsx",
      ],
      reporter: ["text", "json-summary", "json"],
      thresholds: {
        statements: 96,
        branches: 92,
        functions: 98,
        lines: 98,
      },
    },
  },
});
