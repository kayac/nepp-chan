import { z } from "zod";
import type { Intent } from "~/lib/llm-models";
import { getCoreMastra } from "~/mastra/core-mastra";

const intentSchema = z.object({
  intent: z.enum(["casual", "thinking"]),
});

export const classifyIntent = async (message: string): Promise<Intent> => {
  try {
    const agent = getCoreMastra().getAgent("intentRouterAgent");
    const result = await agent.generate(message, {
      structuredOutput: { schema: intentSchema },
    });
    return result.object?.intent ?? "thinking";
  } catch {
    return "thinking";
  }
};
