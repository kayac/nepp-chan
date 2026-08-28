import { describe, expect, it } from "vitest";
import { OPENAI_NANO } from "~/lib/llm-models";
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
  it("最軽量モデルで temperature 0 の決定的分類を行う", () => {
    expect(intentRouterAgent.model).toBe(OPENAI_NANO);
    expect(intentRouterAgent.getDefaultOptions()).toMatchObject({
      modelSettings: { temperature: 0 },
    });
  });

  it("casual と thinking の二値分類で、迷ったら thinking に倒す", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain('"casual"');
    expect(ins).toContain('"thinking"');
    expect(ins).toContain('迷ったら "thinking"');
  });
});
