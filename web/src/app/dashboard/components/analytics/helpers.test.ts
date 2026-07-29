import { describe, expect, it } from "vitest";
import {
  closedContext,
  formatCostUsd,
  jstDateRange,
  pivotWeeklyUsage,
  sumSentiments,
  topEntries,
} from "./helpers";

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

describe("sumSentiments", () => {
  it("sentiment 内訳を合算する", () => {
    expect(
      sumSentiments([
        { positive: 1, negative: 2, request: 0, neutral: 3 },
        { positive: 4, negative: 0, request: 1, neutral: 0 },
      ]),
    ).toEqual({ positive: 5, negative: 2, request: 1, neutral: 3 });
  });

  it("空配列は全て 0", () => {
    expect(sumSentiments([])).toEqual({
      positive: 0,
      negative: 0,
      request: 0,
      neutral: 0,
    });
  });
});

describe("topEntries", () => {
  it("件数の多い順に上位 n 件を返し、0 件は除外する", () => {
    const entries = [
      { label: "a", count: 1 },
      { label: "b", count: 5 },
      { label: "c", count: 0 },
      { label: "d", count: 3 },
    ];

    expect(topEntries(entries, 2)).toEqual([
      { label: "b", count: 5 },
      { label: "d", count: 3 },
    ]);
    expect(topEntries(entries, 10)).toHaveLength(3);
  });
});

describe("closedContext", () => {
  it("閉庁時間の割合と「n件に1件」を返す", () => {
    // 開庁 103 / 閉庁 62 → 全体の 38%、165/62 ≒ 2.66 → 3件に1件
    expect(closedContext(103, 62)).toEqual({ percent: 38, perN: 3 });
  });

  it("閉庁が過半数なら perN は 1 に丸められる", () => {
    expect(closedContext(98, 214)).toEqual({ percent: 69, perN: 1 });
  });

  it("閉庁 0 件なら null（文脈文を出さない）", () => {
    expect(closedContext(10, 0)).toBeNull();
  });

  it("全体 0 件なら null", () => {
    expect(closedContext(0, 0)).toBeNull();
  });
});
