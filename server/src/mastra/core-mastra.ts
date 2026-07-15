import { Mastra } from "@mastra/core/mastra";
import { converterAgent } from "~/mastra/agents/converter-agent";
import { intentRouterAgent } from "~/mastra/agents/intent-router-agent";
import { createKnowledgeAgent } from "~/mastra/agents/knowledge-agent";
import { knowledgeRerankerAgent } from "~/mastra/agents/knowledge-reranker-agent";
import { voiceSummarizerAgent } from "~/mastra/agents/voice-summarizer-agent";
import { createWebResearcherAgent } from "~/mastra/agents/web-researcher-agent";

// FIXME: mastra-ai/mastra#19462 の回避。未登録 Agent の generate() が ephemeral Mastra 経由で
// Scheduler の setInterval(...).unref() を呼び workerd でクラッシュするため、workers: false の
// Mastra に事前登録して回避している。upstream 修正後はこのファイルごと削除し、
// 呼び出し元は Agent を直接 import する形に戻す。
const createCoreMastra = () =>
  new Mastra({
    logger: false,
    workers: false,
    agents: {
      intentRouterAgent,
      converterAgent,
      knowledgeRerankerAgent,
      voiceSummarizerAgent,
      // 共有シングルトン（knowledgeAgent 等）への memory 焼き付けを避けるため voice 専用インスタンス
      voiceKnowledgeAgent: createKnowledgeAgent(),
      voiceWebResearcherAgent: createWebResearcherAgent(),
    },
  });

let mastra: ReturnType<typeof createCoreMastra> | undefined;

export const getCoreMastra = () => {
  mastra ??= createCoreMastra();
  return mastra;
};
