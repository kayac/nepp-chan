import { describe, expect, it } from "vitest";
import { OPENAI_LITE } from "~/lib/llm-models";
import { weeklyReportAgent } from "./weekly-report-agent";

describe("weeklyReportAgent", () => {
  it("抽出済みペルソナの要約のため Luna の medium で動く", () => {
    expect(weeklyReportAgent.model).toBe(OPENAI_LITE);
    expect(weeklyReportAgent.getDefaultOptions()).toMatchObject({
      providerOptions: {
        openai: { reasoningEffort: "medium" },
      },
    });
  });
});
