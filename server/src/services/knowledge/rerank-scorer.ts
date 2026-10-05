import { Agent } from "@mastra/core/agent";
import { createSimilarityPrompt } from "@mastra/core/relevance";
import type { RequestContext } from "@mastra/core/request-context";
import { modelWithReasoning } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { withUsageRecording } from "~/services/analytics/llm-usage";
import {
  createDecider,
  type Decider,
  type YesNoQuestion,
} from "~/services/decision/decider";

const rerankQuestion: YesNoQuestion = {
  type: "yesno",
  instructions: "この文章に、ユーザーの検索語に答える情報が含まれているか。",
  criteria: {
    true: "検索語に直接答える事実、または答えの主要な部分が書かれている。",
    false:
      "話題が違う、または検索語と言葉や大まかな話題が重なるだけで答えになっていない。",
  },
};

// 本家 MastraAgentRelevanceScorer は requestContext を generate に渡せず usage を記録できないため自前実装。instructions は本家と同一
// 呼び出しごとに new すると ephemeral Mastra が増殖するのでモジュールスコープで保持する
const knowledgeRerankAgent = new Agent({
  id: "relevance-scorer-knowledge-reranker",
  name: "Relevance Scorer knowledge-reranker",
  instructions: `You are a specialized agent for evaluating the relevance of text to queries.
Your task is to rate how well a text passage answers a given query.
Output only a number between 0 and 1, where:
1.0 = Perfectly relevant, directly answers the query
0.0 = Completely irrelevant
Consider:
- Direct relevance to the question
- Completeness of information
- Quality and specificity
Always return just the number, no explanation.`,
  ...withUsageRecording(modelWithReasoning({ effort: "none" }), {
    agent: "knowledge-reranker",
    source: "rerank",
  }),
});

const scoreWithLuna = async (
  query: string,
  text: string,
  requestContext?: RequestContext,
) => {
  const response = await knowledgeRerankAgent.generate(
    createSimilarityPrompt(query, text),
    { requestContext },
  );
  return Number.parseFloat(response.text);
};

const scoreWithDecider = async (
  query: string,
  text: string,
  decider: Decider,
) => {
  const { relevant } = await decider.decide(
    { query, passage: text },
    { relevant: rerankQuestion },
  );
  return relevant.p;
};

export const createRerankScorer = (requestContext?: RequestContext) => {
  const decider = createDecider(requestContext, {
    source: "rerank",
    agent: "knowledge-reranker",
  });
  return {
    getRelevanceScore: async (query: string, text: string) => {
      if (!decider) {
        return scoreWithLuna(query, text, requestContext);
      }
      try {
        return await scoreWithDecider(query, text, decider);
      } catch (error) {
        logger.warn("[Rerank] jev failed, falling back to agent", {
          error: String(error),
        });
        return scoreWithLuna(query, text, requestContext);
      }
    },
  };
};
