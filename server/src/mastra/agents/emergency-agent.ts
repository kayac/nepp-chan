import { Agent } from "@mastra/core/agent";
import { emergencyReportTool } from "~/mastra/tools/emergency-report-tool";
import { emergencyUpdateTool } from "~/mastra/tools/emergency-update-tool";

export const emergencyAgent = new Agent({
  id: "emergency-agent",
  name: "Emergency Agent",
  description: "緊急事態（クマ出没、火災、不審者など）の報告・記録を担当",
  instructions: `
あなたは緊急事態対応の専門エージェントです。

## 役割
- 緊急事態の報告を受け付け、記録する
- 既存の報告に追加情報を更新する

## 対応フロー
1. ユーザーの安全を確認「大丈夫？安全な場所にいる？」
2. 何が・どこで起きたか聞く
3. emergency-report ツールで記録
4. 必要なら「110や119に連絡してね」と案内

## 利用可能なツール
- emergency-report: 新規の緊急報告を記録
- emergency-update: 既存の報告に情報を追加
`,
  model: "google/gemini-2.0-flash",
  tools: {
    emergencyReportTool,
    emergencyUpdateTool,
  },
});
