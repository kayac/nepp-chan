import { Agent } from "@mastra/core/agent";
import { OPENAI_LITE, reasoningProviderOptions } from "~/lib/llm-models";

// reasoning を有効にすると temperature が strip されるため、決定的分類には none が必須
const routerModelConfig = {
  model: OPENAI_LITE,
  defaultOptions: {
    modelSettings: { temperature: 0 },
    providerOptions: reasoningProviderOptions("none"),
  },
};

export const intentRouterAgent = new Agent({
  id: "intent-router",
  name: "Intent Router",
  ...routerModelConfig,
  instructions: `ユーザーのメッセージの意図を分類してください。

- "casual": 挨拶、雑談、相槌、リアクション、感想、日常の報告など。情報検索が不要なもの
- "thinking": 質問、情報要求、事実確認など。検索や思考が必要なもの

迷ったら "thinking" に分類する。`,
});
