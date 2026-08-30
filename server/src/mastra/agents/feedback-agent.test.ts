import { describe, expect, it } from "vitest";
import { OPENAI_LITE } from "~/lib/llm-models";
import { feedbackAgent } from "./feedback-agent";

describe("feedbackAgent", () => {
  it("Luna の low で動く", () => {
    expect(feedbackAgent.model).toBe(OPENAI_LITE);
    expect(feedbackAgent.getDefaultOptions()).toMatchObject({
      providerOptions: {
        openai: { reasoningEffort: "low" },
      },
    });
  });
});
