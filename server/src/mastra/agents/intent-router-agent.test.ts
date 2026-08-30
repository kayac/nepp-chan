import { describe, expect, it } from "vitest";
import { OPENAI_LITE } from "~/lib/llm-models";
import { intentRouterAgent } from "./intent-router-agent";

const instructionsOf = async () =>
  String(
    await (
      intentRouterAgent as unknown as {
        getInstructions: (a?: unknown) => Promise<string>;
      }
    ).getInstructions({}),
  );

describe("intentRouterAgent", () => {
  it("Luna の reasoning none と temperature 0 で決定的分類を行う", () => {
    expect(intentRouterAgent.model).toBe(OPENAI_LITE);
    expect(intentRouterAgent.getDefaultOptions()).toMatchObject({
      modelSettings: { temperature: 0 },
      providerOptions: {
        openai: { reasoningEffort: "none" },
      },
    });
  });

  it("casual と thinking の二値分類で、迷ったら thinking に倒す", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain('"casual"');
    expect(ins).toContain('"thinking"');
    expect(ins).toContain('迷ったら "thinking"');
  });
});
