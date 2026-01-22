import { Agent } from "@mastra/core/agent";
import { emergencyReportTool } from "~/mastra/tools/emergency-report-tool";
import { emergencyUpdateTool } from "~/mastra/tools/emergency-update-tool";

export const emergencyReporterAgent = new Agent({
  id: "emergency-reporter-agent",
  name: "Emergency Reporter Agent",
  description:
    "住民の安全・生活に影響する緊急事態の報告を受け付ける。野生動物、災害、火災、事故、インフラ障害など幅広く対応。",
  instructions: `
あなたは緊急事態の報告を受け付ける専門エージェントです。

## 役割
- 緊急事態の報告を受け付け、記録する
- 既存の報告に追加情報を更新する

## 対応する緊急事態（例）
- 野生動物: クマ、シカ、イノシシなどの目撃
- 自然災害: 地震、洪水、土砂崩れ、台風被害、大雪、雪崩
- 火災・爆発
- 不審者・犯罪
- 交通事故
- インフラ障害: 停電、断水、ガス漏れ、道路封鎖、通信障害
- 健康危機: 急病人発見、感染症発生
- 行方不明者
- その他、住民が危険や不安を感じる状況

※上記は例示であり、住民の安全に関わる事態は幅広く受け付ける

## 対応フロー
1. ユーザーの安全を確認「大丈夫？安全な場所にいる？」
2. 何が・どこで・いつ起きたか聞く
3. emergency-report ツールで記録
4. 必要に応じて緊急連絡先を案内（110/119）

## 利用可能なツール
- emergency-report: 新規の緊急報告を記録
- emergency-update: 既存の報告に情報を追加
`,
  model: "google/gemini-flash-latest",
  tools: {
    emergencyReportTool,
    emergencyUpdateTool,
  },
});
