import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~": resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    env: {
      PUBLIC_API_URL: "http://localhost:8787",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/**/*.d.ts",
        "src/types/**",
        "src/pages/**",
        // 薄いラッパー類はユニットテスト対象外
        "src/providers/**",
        "src/components/RootLayout.tsx",
        "src/components/ErrorBoundary.tsx",
        // ページエントリ（Astro から client:only でマウントされる薄い Shell）
        "src/app/chat/App.tsx",
        "src/app/dashboard/DashboardPage.tsx",
        // 外部 SDK 連携が深く E2E 領域。ユニットテストでは費用対効果が見合わない
        "src/components/assistant-ui/Thread.tsx",
        "src/components/assistant-ui/MarkdownText.tsx",
        "src/app/chat/AssistantProvider.tsx",
      ],
      thresholds: {
        branches: 85,
        lines: 39,
        functions: 76,
        statements: 39,
      },
    },
  },
});
