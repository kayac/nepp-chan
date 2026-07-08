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
        // 通話 dev 検証ページ。@twilio/voice-sdk Device（WebRTC）と browser audio が
        // 中心で E2E 領域。API 取得（api.ts）は単体テスト済み、ページはその wiring と rendering のみ
        "src/app/call-dev/CallDevPage.tsx",
        "src/app/call-dev/useCallDevice.ts",
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
        // フォームロジックは usePollForm に抽出済みで L/B/F 100% テスト済み。
        // PollForm 自体は hook の値を JSX に流すだけの presentational shell
        "src/app/dashboard/components/poll/PollForm.tsx",
        // ドラッグ&ドロップ + mutation の orchestration shell。type 判定は trivial で
        // ConvertDialog / useUploadFile / useConvertFile は別途テスト済み
        "src/app/dashboard/components/knowledge/FileUpload.tsx",
        // Math.random とタイマーによる表情遷移の副作用が中心。E2E で担保する設計
        "src/app/chat/components/ChatStandingMascot.tsx",
        // useThreads / useCreateThread / useDeleteThread / useAdminUser /
        // useAnonymousSession の wiring と localStorage sync を行う orchestration
        // hook。依存 hook 側で個々のロジックはテスト済み
        "src/app/chat/hooks/useThreadManager.ts",
        // 型定義のみ（ToolPart 系の type）
        "src/components/chat/types.ts",
        // barrel（knowledge 配下コンポーネントの re-export のみ）
        "src/app/dashboard/components/knowledge/index.ts",
        // d3-force シミュレーション + SVG のドラッグ/パン/ズーム操作が中心で E2E 領域。
        // 役割分類・集計・スナップショットのマージ等の本質ロジックは server 側
        // （services/analytics/ontology*）に抽出済みで、描画・選択の振る舞いは
        // OntologySection.test.tsx で担保している
        "src/app/dashboard/components/analytics/OntologySection.tsx",
        // 型定義 + viewBox 定数のみ
        "src/app/dashboard/components/analytics/ontology-types.ts",
        // recharts の描画ラッパー。tickFormatter / labelFormatter / Cell の
        // 配色コールバックは jsdom では発火せず E2E 領域。集計データは
        // server 側でテスト済み
        "src/app/dashboard/components/analytics/HourlyChart.tsx",
        "src/app/dashboard/components/analytics/WeekdayChart.tsx",
      ],
      thresholds: {
        branches: 88,
        lines: 96,
        functions: 95,
        statements: 95,
      },
    },
  },
});
