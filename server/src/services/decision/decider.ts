import { createTypeSafeAi } from "@ai-sdk/typesafe-ai";
import {
  Classifier,
  type ClassifierQuestions,
  type ClassifierState,
} from "@mastra/core/classifier";
import type { RequestContext } from "@mastra/core/request-context";
import {
  type LlmUsageSource,
  recordUsageFromContext,
  runInBackground,
} from "~/services/analytics/llm-usage";

const JEV_MODEL = "jev-latest";
const JEV_TIMEOUT_MS = 2000;

export const createDecider = (
  requestContext: RequestContext | undefined,
  usage: { source: LlmUsageSource; agent: string },
) => {
  const apiKey = (requestContext?.get("env") as CloudflareBindings | undefined)
    ?.TYPESAFE_API_KEY;
  if (!apiKey) return undefined;
  const classifier = new Classifier({
    id: usage.agent,
    model: createTypeSafeAi({ apiKey }).decisionModel(JEV_MODEL),
  });
  return {
    decide: async <const Q extends ClassifierQuestions>(
      state: ClassifierState,
      questions: Q,
    ) => {
      const startedAt = Date.now();
      const result = await classifier.decide({
        state,
        questions,
        abortSignal: AbortSignal.timeout(JEV_TIMEOUT_MS),
        maxRetries: 0,
      });
      runInBackground(
        recordUsageFromContext(requestContext, {
          model: result.response.modelId,
          usage: {
            inputTokens: result.usage.inputTokens,
            outputTokens: result.usage.outputTokens,
          },
          ...usage,
          durationMs: Date.now() - startedAt,
        }),
      );
      return result.answers;
    },
  };
};

export type Decider = NonNullable<ReturnType<typeof createDecider>>;
