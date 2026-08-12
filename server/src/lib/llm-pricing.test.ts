import { describe, expect, it } from "vitest";
import { calcCostUsd } from "./llm-pricing";

describe("calcCostUsd", () => {
  it("flash モデルは input $0.30/1M・output $2.50/1M で計算する", () => {
    const cost = calcCostUsd("gemini-2.5-flash", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(2.8, 10);
  });

  it("flash-lite モデルは flash に誤マッチせず input $0.10/1M・output $0.40/1M で計算する", () => {
    const cost = calcCostUsd("gemini-2.5-flash-lite", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(0.5, 10);
  });

  it("latest エイリアス（gemini-flash-latest）も flash として解決する", () => {
    const cost = calcCostUsd("gemini-flash-latest", {
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(cost).toBeCloseTo(0.3, 10);
  });

  it("latest エイリアス（gemini-flash-lite-latest）も flash-lite として解決する", () => {
    const cost = calcCostUsd("gemini-flash-lite-latest", {
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(cost).toBeCloseTo(0.1, 10);
  });

  it("pro モデルは input $1.25/1M・output $10.00/1M で計算する", () => {
    const cost = calcCostUsd("gemini-2.5-pro", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(11.25, 10);
  });

  it("luna モデルは input $0.20/1M・output $1.20/1M で計算する", () => {
    const cost = calcCostUsd("openai/gpt-5.6-luna", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(1.4, 10);
  });

  it("terra モデルは input $2.00/1M・output $12.00/1M で計算する", () => {
    const cost = calcCostUsd("openai/gpt-5.6-terra", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(14, 10);
  });

  it("sol モデルは input $5.00/1M・output $30.00/1M で計算する", () => {
    const cost = calcCostUsd("openai/gpt-5.6-sol", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBeCloseTo(35, 10);
  });

  it("reasoning トークンは output 単価で加算する", () => {
    const cost = calcCostUsd("openai/gpt-5.6-luna", {
      inputTokens: 0,
      outputTokens: 500_000,
      reasoningTokens: 500_000,
    });
    expect(cost).toBeCloseTo(1.2, 10);
  });

  it("未知のモデルは 0 を返す", () => {
    const cost = calcCostUsd("gpt-4.1-nano", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBe(0);
  });

  it("トークン 0 はコスト 0 になる", () => {
    expect(
      calcCostUsd("gemini-2.5-flash", { inputTokens: 0, outputTokens: 0 }),
    ).toBe(0);
  });
});
