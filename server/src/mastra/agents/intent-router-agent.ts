import { Agent } from "@mastra/core/agent";
import { deterministicModelConfig } from "~/lib/llm-models";
import { withUsageRecording } from "~/services/analytics/llm-usage";

export const intentRouterAgent = new Agent({
  id: "intent-router",
  name: "Intent Router",
  ...withUsageRecording(deterministicModelConfig, {
    agent: "intent-router",
    source: "intent-classify",
  }),
  instructions: `ユーザーのメッセージの意図を分類してください。

- "casual": 挨拶、雑談、相槌、リアクション、感想、日常の報告など。情報検索が不要なもの
- "thinking": 質問、情報要求、事実確認など。検索や思考が必要なもの

迷ったら "thinking" に分類する。`,
});
