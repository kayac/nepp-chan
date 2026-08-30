import { describe, expect, it } from "vitest";
import { OPENAI_LITE } from "~/lib/llm-models";
import { personaAnalystAgent } from "./persona-analyst-agent";

describe("personaAnalystAgent", () => {
  it("Luna の medium で動く", () => {
    expect(personaAnalystAgent.model).toBe(OPENAI_LITE);
    expect(personaAnalystAgent.getDefaultOptions()).toMatchObject({
      providerOptions: {
        openai: { reasoningEffort: "medium" },
      },
    });
  });
});
