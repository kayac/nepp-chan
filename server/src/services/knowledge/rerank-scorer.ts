import { Agent } from "@mastra/core/agent";
import type { BooleanQuestion } from "@mastra/core/classifier";
import { createSimilarityPrompt } from "@mastra/core/relevance";
import type { RequestContext } from "@mastra/core/request-context";
import { modelWithReasoning } from "~/lib/llm-models";
import { withUsageRecording } from "~/services/analytics/llm-usage";
import { decide } from "~/services/decision/decider";

const rerankQuestion = {
  type: "boolean",
  instructions: "この文章に、ユーザーの検索語に答える情報が含まれているか。",
  criteria: {
    true: "検索語に直接答える事実、または答えの主要な部分が書かれている。",
    false:
      "話題が違う、または検索語と言葉や大まかな話題が重なるだけで答えになっていない。",
  },
} as const satisfies BooleanQuestion;

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
  texts: string[],
  requestContext: RequestContext | undefined,
) => {
  const ids = texts.map((_, i) => `p${i}`);
  const answers = await decide(
    requestContext,
    { source: "rerank", agent: "knowledge-reranker" },
    { query, passages: texts.map((text, i) => ({ id: ids[i], text })) },
    Object.fromEntries(
      ids.map((id) => [
        id,
        {
          ...rerankQuestion,
          instructions: `passages のうち id が ${id} の文章について判定する。${rerankQuestion.instructions}`,
        },
      ]),
    ),
  );
  return answers && ids.map((id) => answers[id].probability);
};

export const scoreRelevance = async (
  query: string,
  texts: string[],
  requestContext?: RequestContext,
) => {
  if (texts.length === 0) return [];
  return (
    (await scoreWithDecider(query, texts, requestContext)) ??
    Promise.all(texts.map((text) => scoreWithLuna(query, text, requestContext)))
  );
};
