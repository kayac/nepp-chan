import type { RequestContext } from "@mastra/core/request-context";
import { z } from "zod";
import type { Intent } from "~/lib/llm-models";
import { intentRouterAgent } from "~/mastra/agents/intent-router-agent";

const intentSchema = z.object({
  intent: z.enum(["casual", "thinking"]),
});

export const classifyIntent = async (
  message: string,
  requestContext?: RequestContext,
): Promise<Intent> => {
  try {
    const result = await intentRouterAgent.generate(message, {
      requestContext,
      structuredOutput: { schema: intentSchema },
    });
    return result.object?.intent ?? "thinking";
  } catch {
    return "thinking";
  }
};
