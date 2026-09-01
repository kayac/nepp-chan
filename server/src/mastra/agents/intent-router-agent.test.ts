import { describe, expect, it } from "vitest";
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
  it("casual と thinking の二値分類で、迷ったら thinking に倒す", async () => {
    const ins = await instructionsOf();
    expect(ins).toContain('"casual"');
    expect(ins).toContain('"thinking"');
    expect(ins).toContain('迷ったら "thinking"');
  });
});
