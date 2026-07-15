import { Agent } from "@mastra/core/agent";
import { GEMINI_FLASH } from "~/lib/llm-models";

// instructions は @mastra/core の MastraAgentRelevanceScorer 内部実装と同等
// （挙動パリティのため英語のまま。日本語ナレッジ向けの調整は必要になってから）
export const knowledgeRerankerAgent = new Agent({
  id: "knowledge-reranker",
  name: "Knowledge Reranker",
  model: GEMINI_FLASH,
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
});
