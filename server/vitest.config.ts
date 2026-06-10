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
        // Mastra Agent / MCP の宣言ファイル。instructions 文字列 + new Agent()
        // が中心でカバレッジ対象とするロジックを持たない
        "src/mastra/agents/**",
        "src/mastra/mcp/**",
        // Mastra Playground 用インスタンス。getPlatformProxy の副作用が中心
        "src/mastra/index.ts",
        // Mastra Playground が生成する自動生成資源（wrangler dev の一時バンドル等）
        "src/mastra/public/**",
        // drizzle ラッパー 1 行
        "src/db/client.ts",
      ],
      thresholds: {
        branches: 87,
        lines: 97,
        functions: 97,
        statements: 96,
      },
    },
  },
});
