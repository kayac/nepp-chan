import { describe, expect, it } from "vitest";
import { formatCostUsd, jstDateRange, pivotWeeklyUsage } from "./helpers";

const row = (weekStart: string, model: string, totalTokens: number) => ({
  weekStart,
  model,
  totalTokens,
  costUsd: 0,
});

describe("pivotWeeklyUsage", () => {
  it("週ごとにモデルをキーにした行へ変換する", () => {
    const { models, rows } = pivotWeeklyUsage([
      row("2026-06-01", "gemini-2.5-flash", 100),
      row("2026-06-01", "gemini-2.5-flash-lite", 50),
      row("2026-06-08", "gemini-2.5-flash", 200),
    ]);

    expect(models).toEqual(["gemini-2.5-flash", "gemini-2.5-flash-lite"]);
    expect(rows).toEqual([
      {
        weekStart: "2026-06-01",
        "gemini-2.5-flash": 100,
        "gemini-2.5-flash-lite": 50,
      },
      { weekStart: "2026-06-08", "gemini-2.5-flash": 200 },
    ]);
  });

  it("空配列は空の結果を返す", () => {
    expect(pivotWeeklyUsage([])).toEqual({ models: [], rows: [] });
  });
});

describe("formatCostUsd", () => {
  it("小数 4 桁の USD 表記にする", () => {
    expect(formatCostUsd(0.01234)).toBe("$0.0123");
    expect(formatCostUsd(0)).toBe("$0.0000");
  });
});

describe("jstDateRange", () => {
  it("直近 days 日の JST 日付範囲を返す（両端を含む）", () => {
    // UTC 2026-06-11 16:00 = JST 2026-06-12 01:00
    const now = new Date("2026-06-11T16:00:00.000Z");

    expect(jstDateRange(30, now)).toEqual({
      from: "2026-05-14",
      to: "2026-06-12",
    });
    expect(jstDateRange(1, now)).toEqual({
      from: "2026-06-12",
      to: "2026-06-12",
    });
  });
});
