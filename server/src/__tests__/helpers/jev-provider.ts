import { vi } from "vitest";

export const doDecideMock = vi.fn();

export const createTypeSafeAi = vi.fn(() => ({
  decisionModel: () => ({
    specificationVersion: "v4" as const,
    provider: "typesafe.decision",
    modelId: "jev-latest",
    supportedQuestionTypes: ["choice", "score", "boolean"] as const,
    doDecide: doDecideMock,
  }),
}));

export const choiceAnswer = <P extends Record<string, number>>(
  choice: keyof P & string,
  probabilities: P,
) => ({ type: "choice" as const, choice, probabilities });

export const booleanAnswer = (probability: number) => ({
  type: "boolean" as const,
  probability,
});

export const decision = (
  answers: Record<string, unknown>,
  options: {
    modelId?: string;
    usage?: { inputTokens?: number; outputTokens?: number };
  } = {},
) => ({
  answers,
  usage: options.usage ?? {},
  rounding: { probabilityDecimals: 2, scoreDecimals: 2 },
  warnings: [],
  response: { modelId: options.modelId ?? "jev-latest" },
});
