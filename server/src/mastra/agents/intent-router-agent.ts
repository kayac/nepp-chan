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
- "thinking": 複雑な質問、詳細な情報要求、分析依頼、複数の情報源が必要なもの。深い思考やツール使い分けが必要`,
});
