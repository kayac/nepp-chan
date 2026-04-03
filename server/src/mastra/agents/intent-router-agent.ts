import { Agent } from "@mastra/core/agent";
import { GEMINI_FLASH_LITE } from "~/lib/llm-models";

const routerModelConfig = {
  model: GEMINI_FLASH_LITE,
  providerOptions: {
    google: {
      thinkingConfig: { thinkingLevel: "none" as const },
      generationConfig: { temperature: 0 },
    },
  },
};

export const intentRouterAgent = new Agent({
  id: "intent-router",
  name: "Intent Router",
  ...routerModelConfig,
  instructions: `ユーザーのメッセージの意図を分類してください。

- "casual": 挨拶、雑談、相槌、リアクション、感想、日常の報告など。情報検索が不要なもの
- "normal": 簡単な質問、事実確認、天気、雑学など。軽い検索で済むもの
- "thinking": 複雑な質問、詳細な情報要求、分析依頼、複数の情報源が必要なもの。深い思考やツール使い分けが必要

## ドメイン特性による補正
以下のトピックは見た目がシンプルでも複雑な処理が必要なため "thinking" に分類する:
- ゴミ・ごみ・収集日・カレンダー（日付計算・曜日判定が必要）
- 入試・入学・出願・合格（複数情報源の横断が必要）
- 届出・申請・手続き（条件分岐・期限判定が必要）
- 料金・費用・税（年度・改定による変動あり）
- 防災・避難・緊急（正確性が最重要）

以下のトピックは単純な情報転記で済むため "normal" で十分:
- 窓口・電話番号・担当課・問い合わせ先
- 施設の場所・住所・アクセス
- 営業時間・開館時間（固定情報）`,
});
