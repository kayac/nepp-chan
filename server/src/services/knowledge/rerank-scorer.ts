import { Agent } from "@mastra/core/agent";
import { createSimilarityPrompt } from "@mastra/core/relevance";
import type { RequestContext } from "@mastra/core/request-context";
import { type JevQuestion, jevApiKey } from "~/lib/jev";
import { modelWithReasoning, OPENAI_LITE } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import {
  askJevWithUsage,
  withUsageRecording,
} from "~/services/analytics/llm-usage";

const rerankQuestion: JevQuestion = {
  type: "noul",
  instructions:
    "Does the passage contain information that answers the user's query?",
  criteria: {
    true: "The passage states facts that directly answer the query or are a substantial part of the answer.",
    false:
      "The passage is off-topic, or only shares words or the general topic with the query without answering it.",
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
  ...withUsageRecording(
    modelWithReasoning({ model: OPENAI_LITE, effort: "none" }),
    { agent: "knowledge-reranker", source: "rerank" },
  ),
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

const scoreWithJev = async (
  query: string,
  text: string,
  apiKey: string,
  requestContext: RequestContext,
) => {
  const response = await askJevWithUsage({
    apiKey,
    state: { query, passage: text },
    questions: { relevant: rerankQuestion },
    requestContext,
    source: "rerank",
    agent: "knowledge-reranker",
  });
  const answer = response.answers.relevant;
  if (answer?.type !== "noul") {
    throw new Error("jev answer has no noul");
  }
  return answer.noul;
};

export const createRerankScorer = (requestContext?: RequestContext) => {
  const apiKey = jevApiKey(requestContext);
  return {
    getRelevanceScore: async (query: string, text: string) => {
      if (!apiKey || !requestContext) {
        return scoreWithLuna(query, text, requestContext);
      }
      try {
        return await scoreWithJev(query, text, apiKey, requestContext);
      } catch (error) {
        logger.warn("[Rerank] jev failed, falling back to agent", {
          error: String(error),
        });
        return scoreWithLuna(query, text, requestContext);
      }
    },
  };
};
