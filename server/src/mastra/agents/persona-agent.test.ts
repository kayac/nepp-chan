import { describe, expect, it } from "vitest";
import { OPENAI_LITE } from "~/lib/llm-models";
import { createPersonaAgent, personaAgent } from "./persona-agent";

describe("personaAgent", () => {
  it("観点固定の抽出のため Luna の medium で動く", () => {
    expect(personaAgent.model).toBe(OPENAI_LITE);
    expect(personaAgent.getDefaultOptions()).toMatchObject({
      providerOptions: {
        openai: { reasoningEffort: "medium" },
      },
    });
  });

  it("既定は標準 tier（管理画面の手動抽出を待たせない）", () => {
    const options = personaAgent.getDefaultOptions() as {
      providerOptions: { openai: Record<string, unknown> };
    };
    expect(options.providerOptions.openai).not.toHaveProperty("serviceTier");
  });

  it("serviceTier 指定で flex の providerOptions を持つ", () => {
    const agent = createPersonaAgent({ serviceTier: "flex" });
    expect(agent.getDefaultOptions()).toMatchObject({
      providerOptions: {
        openai: { serviceTier: "flex" },
      },
    });
  });
});
