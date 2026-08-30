import { describe, expect, it } from "vitest";
import { OPENAI_LITE } from "~/lib/llm-models";
import { converterAgent } from "./converter-agent";

describe("converterAgent", () => {
  it("観点固定の変換処理のため Luna の low で動く", () => {
    expect(converterAgent.model).toBe(OPENAI_LITE);
    expect(converterAgent.getDefaultOptions()).toMatchObject({
      providerOptions: {
        openai: { reasoningEffort: "low" },
      },
    });
  });
});
