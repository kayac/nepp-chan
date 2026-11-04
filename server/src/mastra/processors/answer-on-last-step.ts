import type { InputProcessor } from "@mastra/core/processors";

export const answerOnLastStep = (maxSteps: number): InputProcessor => ({
  id: "answer-on-last-step",
  processInputStep: ({ stepNumber }) =>
    stepNumber >= maxSteps - 1 ? { toolChoice: "none" } : {},
});
