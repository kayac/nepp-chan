import type {
  ScorerRunInputForAgent,
  ScorerRunOutputForAgent,
} from "@mastra/core/evals";
import { createTestMessage } from "@mastra/evals/scorers/utils";

export type GateRun = {
  input: ScorerRunInputForAgent;
  output: ScorerRunOutputForAgent;
};

export const buildGateRun = ({
  turns,
  stepTexts,
  finalText,
  tools,
}: {
  turns: readonly string[];
  stepTexts: string[];
  finalText: string;
  tools: string[];
}) => {
  const body = finalText.trim();
  const preamble =
    stepTexts.length > 1 && stepTexts.at(-1) === body
      ? stepTexts.slice(0, -1).join("\n\n")
      : "";
  const run: GateRun = {
    input: {
      inputMessages: turns.map((t) =>
        createTestMessage({ content: t, role: "user" }),
      ),
      rememberedMessages: [],
      systemMessages: [],
      taggedSystemMessages: {},
    },
    output: [
      ...(preamble
        ? [createTestMessage({ content: preamble, role: "assistant" })]
        : []),
      createTestMessage({
        content: body,
        role: "assistant",
        toolInvocations: tools.map((name, i) => ({
          toolCallId: `call-${i}`,
          toolName: name,
          args: {},
          result: {},
          state: "result",
        })),
      }),
    ],
  };
  return { run, text: preamble ? `${preamble}\n\n${body}` : body };
};
