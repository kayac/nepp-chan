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
        // Sentry 初期化・薄いラッパー類はユニットテスト対象外
        "src/lib/sentry.ts",
        "src/providers/**",
        "src/components/RootLayout.tsx",
        "src/components/SentryErrorBoundary.tsx",
        // ページエントリ（Astro から client:only でマウントされる薄い Shell）
        "src/app/chat/App.tsx",
        "src/app/dashboard/DashboardPage.tsx",
        // 完全に form の rendering のみ。ロジックは useLoginForm / useRegisterForm 側でテスト済み
        "src/app/auth/LoginPage.tsx",
        "src/app/auth/RegisterPage.tsx",
        // メッセージ一覧と footer の組み立てだけの orchestration shell。
        // 描画ロジックは MarkdownText / ToolPart / Composer / useStickToBottom に抽出済み
        "src/components/chat/Thread.tsx",
        // useChat の wiring と context 配布のみ
        "src/app/chat/contexts/ChatProvider.tsx",
        // barrel / registry。toolName → コンポーネントのマッピングだけで分岐ロジックを持たない
        "src/components/chat/tool-uis/index.ts",
        // dashboard / chat のオーケストレーション shell。ロジックは hooks/dashboard・
        // helpers・子コンポーネント側に抽出済みで、Panel 自身は tab/filter state と
        // 子コンポーネントの mount を担うだけ。テストは抽出済みの helper / hook 側で行う
        "src/app/chat/ChatPage.tsx",
        "src/app/dashboard/App.tsx",
        "src/app/dashboard/components/BroadcastPanel.tsx",
        "src/app/dashboard/components/FeedbackPanel.tsx",
        "src/app/dashboard/components/InvitationsPanel.tsx",
        "src/app/dashboard/components/KnowledgePanel.tsx",
        "src/app/dashboard/components/PersonaPanel.tsx",
        "src/app/dashboard/components/PollPanel.tsx",
        // ドラッグ&ドロップ + mutation の orchestration shell。type 判定は trivial で
        // ConvertDialog / useUploadFile / useConvertFile は別途テスト済み
        "src/app/dashboard/components/knowledge/FileUpload.tsx",
        // Math.random とタイマーによる表情遷移の副作用が中心。E2E で担保する設計
        "src/app/chat/components/ChatStandingMascot.tsx",
        // useThreads / useCreateThread / useDeleteThread / useAdminUser /
        // useAnonymousSession の wiring と localStorage sync を行う orchestration
        // hook。依存 hook 側で個々のロジックはテスト済み
        "src/app/chat/hooks/useThreadManager.ts",
      ],
      thresholds: {
        branches: 85,
        lines: 92,
        functions: 90,
        statements: 92,
      },
    },
  },
});
