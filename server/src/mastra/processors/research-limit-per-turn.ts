import type { InputProcessor } from "@mastra/core/processors";

export const researchLimitPerTurn = (
  toolName: string,
  maxCalls: number,
): InputProcessor => ({
  id: "research-limit-per-turn",
  processInputStep: ({ steps, tools }) => {
    const calls = steps
      .flatMap((step) => step.toolCalls)
      .filter((call) => call.toolName === toolName).length;
    if (calls < maxCalls) return {};
    return {
      activeTools: Object.keys(tools ?? {}).filter((name) => name !== toolName),
    };
  },
});
