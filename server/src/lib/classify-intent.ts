import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import { askJev, JEV_MODEL, type JevQuestion } from "~/lib/jev";
import { logger } from "~/lib/logger";
import { intentRouterAgent } from "~/mastra/agents/intent-router-agent";
import {
  recordUsageFromContext,
  runInBackground,
} from "~/services/analytics/llm-usage";

const THINKING_THRESHOLD = 0.3;

export const intentQuestion: JevQuestion = {
  type: "choice",
  instructions:
    "Classify the intent of the user's latest message. When in doubt, choose thinking.",
  criteria: {
    casual:
      "Greeting, small talk, acknowledgement, reaction, sharing feelings or daily events. No information lookup is needed.",
    thinking:
      "A question, information request, or fact check that needs search or reasoning to answer.",
  },
};

const intentSchema = z.object({
  intent: z.enum(["casual", "thinking"]),
});

export type ClassifyIntentInput = {
  text: string;
  previousAssistant?: string;
};

export const buildIntentState = (input: ClassifyIntentInput) => [
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
  const startedAt = Date.now();
  const response = await askJev({
    apiKey,
    state: buildIntentState(input),
    questions: { intent: intentQuestion },
  });
  runInBackground(
    recordUsageFromContext(requestContext, {
      model: response.model ?? JEV_MODEL,
      usage: {
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      },
      source: "intent-classify",
      agent: "intent-router",
      durationMs: Date.now() - startedAt,
    }),
  );
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
  const apiKey = (requestContext?.get("env") as CloudflareBindings | undefined)
    ?.TYPESAFE_API_KEY;
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
