import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";
import { geminiModelWithThinking } from "~/lib/llm-models";

export const webResearcherAgent = new Agent({
  id: "web-researcher",
  name: "Web Researcher",
  description: `インターネットから最新情報を収集するエージェント。
    Google検索グラウンディングを使って、リアルタイムの情報を取得し要約を提供する。`,
  instructions: `
あなたはインターネットから最新情報を収集する専門エージェントです。

【役割】
- Google検索を使って最新の情報を取得する
- 収集した情報を整理して分かりやすくまとめる
- 情報源を明記して信頼性を担保する

【回答のルール】
- 検索結果に基づいて正確に回答する
- 情報源（URL）があれば明記する。関連するURLだけを厳選し、重複は1つにまとめる
- URLは検索結果から得たもののみ使用し、推測や捏造は絶対にしない
- 情報が見つからない場合はその旨を正直に伝える
- 推測や憶測は避け、事実に基づいて回答する
`,
  ...geminiModelWithThinking(),
  tools: {
    googleSearch: google.tools.googleSearch({}),
  },
});
