import type { ChoiceQuestion } from "@mastra/core/classifier";
import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import type { Intent } from "~/lib/llm-models";
import { intentRouterAgent } from "~/mastra/agents/intent-router-agent";
import { decide } from "~/services/decision/decider";

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
): Promise<TurnClass> => {
  const answers = await decide(
    requestContext,
    { source: "intent-classify", agent: "intent-router" },
    buildState(input),
    { intent: intentQuestion },
  );
  if (!answers) return classifyWithAgent(input.text, requestContext);
  const pThinking = answers.intent.probabilities?.thinking ?? 1;
  return { intent: pThinking >= THINKING_THRESHOLD ? "thinking" : "casual" };
};
