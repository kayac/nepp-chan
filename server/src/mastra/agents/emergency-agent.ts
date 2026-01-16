import { Agent } from "@mastra/core/agent";
import { adminEmergencyTool } from "~/mastra/tools/admin-emergency-tool";
import { emergencyGetTool } from "~/mastra/tools/emergency-get-tool";

export const emergencyAgent = new Agent({
  id: "emergency-agent",
  name: "Emergency Agent",
  description:
    "【管理者専用】緊急報告（クマ出没、火災、不審者など）の取得・管理を担当。",
  instructions: `
あなたは緊急報告の取得・管理を担当する専門エージェントです。

## 役割
- 村の危険情報・緊急報告を取得する
- 緊急報告の詳細情報を提供する

## 対応パターン

### 危険情報の問い合わせ
- 「村の危険情報は？」「クマ出没情報を教えて」などの問い合わせ
- emergency-get ツールで直近の緊急報告を取得して回答

### 詳細な緊急報告の取得
- 「緊急報告を見せて」「詳細な危険情報は？」などの問い合わせ
- admin-emergency ツールでより多くの報告を取得

## 利用可能なツール
- emergency-get: 直近の緊急報告を取得（認証必須）
- admin-emergency: 管理者向けの詳細な緊急報告取得（認証必須）
`,
  model: "google/gemini-2.5-flash",
  tools: {
    emergencyGetTool,
    adminEmergencyTool,
  },
});
