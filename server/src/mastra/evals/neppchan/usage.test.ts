import { describe, expect, it } from "vitest";
import {
  addProviderUsage,
  addUsage,
  costUsd,
  emptyUsage,
  sumUsage,
} from "./usage";

describe("usage", () => {
  it("AI SDK の usage を呼び出し回数つきで積み上げる", () => {
    const t = emptyUsage();
    addUsage(t, {
      inputTokens: 1000,
      outputTokens: 200,
      inputTokenDetails: { cacheReadTokens: 400 },
    });
    addUsage(t, { inputTokens: 500, outputTokens: undefined });
    addUsage(t, undefined);
    expect(t).toEqual({
      calls: 2,
      inputTokens: 1500,
      outputTokens: 200,
      cachedInputTokens: 400,
    });
  });

  it("プロバイダ形式の usage も同じ合計に変換する", () => {
    const t = addProviderUsage(emptyUsage(), {
      inputTokens: { total: 300, cacheRead: 200 },
      outputTokens: { total: 50 },
    });
    expect(t).toEqual({
      calls: 1,
      inputTokens: 300,
      outputTokens: 50,
      cachedInputTokens: 200,
    });
  });

  it("合計はキャッシュ分を割り引いた金額になる", () => {
    const total = sumUsage([
      {
        calls: 1,
        inputTokens: 1_000_000,
        outputTokens: 0,
        cachedInputTokens: 0,
      },
      {
        calls: 1,
        inputTokens: 0,
        outputTokens: 1_000_000,
        cachedInputTokens: 0,
      },
    ]);
    expect(total.calls).toBe(2);
    expect(costUsd("openai/gpt-5.6-luna", total)).toBeCloseTo(1.4, 6);
    expect(
      costUsd("openai/gpt-5.6-luna", {
        calls: 1,
        inputTokens: 1_000_000,
        outputTokens: 0,
        cachedInputTokens: 1_000_000,
      }),
    ).toBeCloseTo(0.02, 6);
  });
});
