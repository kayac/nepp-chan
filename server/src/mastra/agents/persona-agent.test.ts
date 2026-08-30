import { describe, expect, it } from "vitest";
import { OPENAI_LITE } from "~/lib/llm-models";
import { personaAgent } from "./persona-agent";

describe("personaAgent", () => {
  it("観点固定の抽出のため Luna の medium で動く", () => {
    expect(personaAgent.model).toBe(OPENAI_LITE);
    expect(personaAgent.getDefaultOptions()).toMatchObject({
      providerOptions: {
        openai: { reasoningEffort: "medium" },
      },
    });
  });
});
