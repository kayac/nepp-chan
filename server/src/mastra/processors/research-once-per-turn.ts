import type { InputProcessor } from "@mastra/core/processors";

export const researchOncePerTurn = (toolName: string): InputProcessor => ({
  id: "research-once-per-turn",
  processInputStep: ({ steps, tools }) => {
    const researched = steps.some((step) =>
      step.toolCalls.some((call) => call.toolName === toolName),
    );
    if (!researched) return {};
    return {
      activeTools: Object.keys(tools ?? {}).filter((name) => name !== toolName),
    };
  },
});
