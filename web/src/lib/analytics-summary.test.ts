import { describe, expect, it } from "vitest";
import {
  closedContext,
  dailyBars,
  PLATFORM_LABELS,
  sumSentiments,
  topEntries,
} from "./analytics-summary";

describe("PLATFORM_LABELS", () => {
  it("ウィジェットの表示名を返す", () => {
    expect(PLATFORM_LABELS.widget).toBe("ウィジェット");
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

describe("dailyBars", () => {
  it("日付から曜日つきの月日ラベルを作る", () => {
    const bars = dailyBars([
      { date: "2026-08-01", conversations: 2 },
      { date: "2026-08-03", conversations: 6 },
    ]);

    expect(bars[0]).toEqual({
      date: "2026-08-01",
      label: "8/1(土)",
      conversations: 2,
      closed: true,
    });
    expect(bars[1]).toEqual({
      date: "2026-08-03",
      label: "8/3(月)",
      conversations: 6,
      closed: false,
    });
  });

  it("空配列は空配列", () => {
    expect(dailyBars([])).toEqual([]);
  });
});
