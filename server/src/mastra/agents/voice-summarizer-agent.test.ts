import { describe, expect, it } from "vitest";
import { OPENAI_LITE } from "~/lib/llm-models";
import {
  NEED_KNOWLEDGE,
  NEED_WEB,
  voiceSummarizerAgent,
} from "./voice-summarizer-agent";

const instructionsOf = async () =>
  String(
    await (
      voiceSummarizerAgent as unknown as {
        getInstructions: (a?: unknown) => Promise<string>;
      }
    ).getInstructions({}),
  );

describe("voiceSummarizerAgent", () => {
  it("Luna の reasoning none と temperature 0 で決定的要約を行う", () => {
    expect(voiceSummarizerAgent.model).toBe(OPENAI_LITE);
    expect(voiceSummarizerAgent.getDefaultOptions()).toMatchObject({
      modelSettings: { temperature: 0 },
      providerOptions: {
        openai: { reasoningEffort: "none" },
      },
    });
  });

  it("資料で答えられないときの委譲シグナルを指示に含む", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain(NEED_KNOWLEDGE);
    expect(ins).toContain(NEED_WEB);
  });
});
