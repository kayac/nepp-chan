import { describe, expect, it } from "vitest";
import {
  percentChange,
  sumConversationsInRange,
  topTopics,
  troubleTopics,
  weekPeriods,
} from "./helpers";

const topic = (
  name: string,
  counts: Partial<{
    total: number;
    positive: number;
    negative: number;
    request: number;
    neutral: number;
  }> = {},
) => ({
  topic: name,
  total: counts.total ?? 0,
  positive: counts.positive ?? 0,
  negative: counts.negative ?? 0,
  request: counts.request ?? 0,
  neutral: counts.neutral ?? 0,
});

describe("weekPeriods", () => {
  it("水曜日なら今週は月曜〜当日、前週は月曜〜日曜", () => {
    // 2026-07-29 は水曜
    const result = weekPeriods(new Date("2026-07-29T10:00:00"));
    expect(result.current).toEqual({ from: "2026-07-27", to: "2026-07-29" });
    expect(result.previous).toEqual({ from: "2026-07-20", to: "2026-07-26" });
  });

  it("月曜日なら今週は当日1日だけ", () => {
    const result = weekPeriods(new Date("2026-07-27T00:30:00"));
    expect(result.current).toEqual({ from: "2026-07-27", to: "2026-07-27" });
    expect(result.previous).toEqual({ from: "2026-07-20", to: "2026-07-26" });
  });

  it("日曜日は前週扱いにせず今週の月曜起点", () => {
    const result = weekPeriods(new Date("2026-08-02T23:00:00"));
    expect(result.current).toEqual({ from: "2026-07-27", to: "2026-08-02" });
    expect(result.previous).toEqual({ from: "2026-07-20", to: "2026-07-26" });
  });

  it("月をまたぐ週も日付計算が正しい", () => {
    // 2026-08-01 は土曜
    const result = weekPeriods(new Date("2026-08-01T12:00:00"));
    expect(result.current).toEqual({ from: "2026-07-27", to: "2026-08-01" });
  });
});

describe("troubleTopics", () => {
  it("ネガティブ + 要望の合計が多い順に返す", () => {
    const current = [
      topic("観光", { negative: 1, positive: 5 }),
      topic("生活", { negative: 4, request: 2 }),
      topic("除雪", { request: 3 }),
    ];
    const result = troubleTopics(current, []);
    expect(result.map((t) => t.topic)).toEqual(["生活", "除雪", "観光"]);
    expect(result[0].count).toBe(6);
  });

  it("困りごとゼロのトピックは含めない", () => {
    const current = [
      topic("観光", { positive: 5, neutral: 2 }),
      topic("生活", { negative: 1 }),
    ];
    const result = troubleTopics(current, []);
    expect(result.map((t) => t.topic)).toEqual(["生活"]);
  });

  it("前週比 diff を含む", () => {
    const current = [topic("生活", { negative: 5 })];
    const previous = [topic("生活", { negative: 2, request: 1 })];
    const result = troubleTopics(current, previous);
    expect(result[0].diff).toBe(2);
  });

  it("limit で件数を絞る", () => {
    const current = [
      topic("観光", { negative: 3 }),
      topic("生活", { negative: 2 }),
      topic("除雪", { negative: 1 }),
    ];
    expect(troubleTopics(current, [], 2)).toHaveLength(2);
  });
});

describe("topTopics", () => {
  it("total 降順で返し、0 件のトピックは含めない", () => {
    const current = [
      topic("観光", { total: 10 }),
      topic("生活", { total: 0 }),
      topic("行政", { total: 3 }),
    ];
    const result = topTopics(current, []);
    expect(result.map((t) => t.topic)).toEqual(["観光", "行政"]);
  });

  it("前週 0 件から増えたトピックは isNew", () => {
    const current = [topic("観光", { total: 5 }), topic("行政", { total: 4 })];
    const previous = [topic("観光", { total: 3 })];
    const result = topTopics(current, previous);
    expect(result.find((t) => t.topic === "行政")?.isNew).toBe(true);
    expect(result.find((t) => t.topic === "観光")?.isNew).toBe(false);
  });

  it("前週比 diff を含む", () => {
    const current = [topic("観光", { total: 5 })];
    const previous = [topic("観光", { total: 3 })];
    expect(topTopics(current, previous)[0].diff).toBe(2);
  });

  it("limit で件数を絞る", () => {
    const current = [
      topic("観光", { total: 3 }),
      topic("生活", { total: 2 }),
      topic("除雪", { total: 1 }),
    ];
    expect(topTopics(current, [], 2)).toHaveLength(2);
  });
});

describe("sumConversationsInRange", () => {
  const daily = [
    { date: "2026-07-26", conversations: 10 },
    { date: "2026-07-27", conversations: 3 },
    { date: "2026-07-29", conversations: 7 },
    { date: "2026-08-01", conversations: 5 },
  ];

  it("from/to（両端含む）の会話数を合計する", () => {
    expect(sumConversationsInRange(daily, "2026-07-27", "2026-07-29")).toBe(10);
  });

  it("該当日がなければ 0", () => {
    expect(sumConversationsInRange(daily, "2026-09-01", "2026-09-07")).toBe(0);
  });
});

describe("percentChange", () => {
  it("増減率を整数パーセントで返す", () => {
    expect(percentChange(112, 100)).toBe(12);
    expect(percentChange(90, 100)).toBe(-10);
  });

  it("前週 0 件なら null（比較不能）", () => {
    expect(percentChange(10, 0)).toBeNull();
  });
});
