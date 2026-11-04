import type { ChoiceQuestion } from "@mastra/core/classifier";
import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import type { Intent } from "~/lib/llm-models";
import { logger } from "~/lib/logger";
import { intentRouterAgent } from "~/mastra/agents/intent-router-agent";
import { createDecider, type Decider } from "~/services/decision/decider";

const THINKING_THRESHOLD = 0.3;

const intentQuestion = {
  type: "choice",
  instructions:
    "ユーザーの最新のメッセージの意図を分類する。迷ったら thinking にする。",
  criteria: {
    casual:
      "挨拶、雑談、相槌、リアクション、気持ちや日常の出来事の共有。情報を調べる必要がない。",
    thinking: "検索や推論が必要な質問、情報の依頼、事実確認。",
  },
} as const satisfies ChoiceQuestion;

const intentSchema = z.object({
  intent: z.enum(["casual", "thinking"]),
});

type TurnClass = { intent: Intent };

type ClassifyTurnInput = {
  text: string;
  previousAssistant?: string;
};

const buildState = (input: ClassifyTurnInput) => [
  ...(input.previousAssistant
    ? [{ from: "assistant", text: input.previousAssistant }]
    : []),
  { from: "user", text: input.text },
];

const classifyWithDecider = async (
  input: ClassifyTurnInput,
  decider: Decider,
): Promise<TurnClass> => {
  const { intent } = await decider.decide(buildState(input), {
    intent: intentQuestion,
  });
  const pThinking = intent.probabilities?.thinking ?? 1;
  return { intent: pThinking >= THINKING_THRESHOLD ? "thinking" : "casual" };
};

const classifyWithAgent = async (
  text: string,
  requestContext?: RequestContext,
): Promise<TurnClass> => {
  try {
    const result = await intentRouterAgent.generate(text, {
      requestContext,
      structuredOutput: { schema: intentSchema },
    });
    return { intent: result.object?.intent ?? "thinking" };
  } catch {
    return { intent: "thinking" };
  }
};

export const classifyTurn = async (
  input: ClassifyTurnInput,
  requestContext?: RequestContext,
) => {
  const decider = createDecider(requestContext, {
    source: "intent-classify",
    agent: "intent-router",
  });
  if (!decider) {
    return classifyWithAgent(input.text, requestContext);
  }
  try {
    return await classifyWithDecider(input, decider);
  } catch (error) {
    logger.warn("[ClassifyTurn] jev failed, falling back to agent", {
      error: String(error),
    });
    return classifyWithAgent(input.text, requestContext);
  }
};
