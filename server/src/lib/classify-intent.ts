import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import { type JevQuestion, jevApiKey } from "~/lib/jev";
import { logger } from "~/lib/logger";
import { intentRouterAgent } from "~/mastra/agents/intent-router-agent";
import { askJevWithUsage } from "~/services/analytics/llm-usage";

const THINKING_THRESHOLD = 0.3;

const intentQuestion: JevQuestion = {
  type: "choice",
  instructions:
    "ユーザーの最新のメッセージの意図を分類する。迷ったら thinking にする。",
  criteria: {
    casual:
      "挨拶、雑談、相槌、リアクション、気持ちや日常の出来事の共有。情報を調べる必要がない。",
    thinking: "検索や推論が必要な質問、情報の依頼、事実確認。",
  },
};

const intentSchema = z.object({
  intent: z.enum(["casual", "thinking"]),
});

type ClassifyIntentInput = {
  text: string;
  previousAssistant?: string;
};

const buildIntentState = (input: ClassifyIntentInput) => [
  ...(input.previousAssistant
    ? [{ from: "assistant", text: input.previousAssistant }]
    : []),
  { from: "user", text: input.text },
];

const classifyWithJev = async (
  input: ClassifyIntentInput,
  apiKey: string,
  requestContext: RequestContext,
) => {
  const response = await askJevWithUsage({
    apiKey,
    state: buildIntentState(input),
    questions: { intent: intentQuestion },
    requestContext,
    source: "intent-classify",
    agent: "intent-router",
  });
  const answer = response.answers.intent;
  const pThinking =
    answer?.type === "choice" ? answer.probabilities.thinking : undefined;
  if (pThinking === undefined) {
    throw new Error("jev answer has no thinking probability");
  }
  return pThinking >= THINKING_THRESHOLD ? "thinking" : "casual";
};

const classifyWithAgent = async (
  text: string,
  requestContext?: RequestContext,
) => {
  try {
    const result = await intentRouterAgent.generate(text, {
      requestContext,
      structuredOutput: { schema: intentSchema },
    });
    return result.object?.intent ?? "thinking";
  } catch {
    return "thinking";
  }
};

export const classifyIntent = async (
  input: ClassifyIntentInput,
  requestContext?: RequestContext,
) => {
  const apiKey = jevApiKey(requestContext);
  if (!apiKey || !requestContext) {
    return classifyWithAgent(input.text, requestContext);
  }
  try {
    return await classifyWithJev(input, apiKey, requestContext);
  } catch (error) {
    logger.warn("[ClassifyIntent] jev failed, falling back to agent", {
      error: String(error),
    });
    return classifyWithAgent(input.text, requestContext);
  }
};
