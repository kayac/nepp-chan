import { describe, expect, it } from "vitest";
import { OPENAI_LITE } from "~/lib/llm-models";
import { emergencyAgent } from "./emergency-agent";

describe("emergencyAgent", () => {
  it("Luna の low で動く", () => {
    expect(emergencyAgent.model).toBe(OPENAI_LITE);
    expect(emergencyAgent.getDefaultOptions()).toMatchObject({
      providerOptions: {
        openai: { reasoningEffort: "low" },
      },
    });
  });
});
