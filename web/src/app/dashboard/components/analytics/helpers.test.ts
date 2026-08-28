import { describe, expect, it } from "vitest";
import {
  agentLabel,
  cacheRatePercent,
  formatCostJpy,
  formatCostUsd,
  formatDurationSeconds,
  formatJstTime,
  jstDateRange,
  pivotWeeklyUsage,
  platformLabel,
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

describe("formatCostJpy", () => {
  it("1USD=150円換算の円表記にする", () => {
    expect(formatCostJpy(0.05)).toBe("¥7.5");
    expect(formatCostJpy(0)).toBe("¥0");
  });
});

describe("formatJstTime", () => {
  it("UTC の ISO 文字列を JST の月日と時刻にする", () => {
    // UTC 8/25 08:24 = JST 8/25 17:24
    expect(formatJstTime("2026-08-25T08:24:00.000Z")).toBe("8/25 17:24");
  });
});

describe("formatDurationSeconds", () => {
  it("秒数を単位付きで表示し、null は - にする", () => {
    expect(formatDurationSeconds(null)).toBe("-");
    expect(formatDurationSeconds(45)).toBe("45秒");
    expect(formatDurationSeconds(630)).toBe("10分30秒");
    expect(formatDurationSeconds(3660)).toBe("1時間1分");
  });
});

describe("platformLabel", () => {
  it("チャネル名を表示名に変換し、null は不明にする", () => {
    expect(platformLabel("web")).toBe("Web");
    expect(platformLabel("voice")).toBe("電話");
    expect(platformLabel(null)).toBe("不明");
    expect(platformLabel("unknown-platform")).toBe("unknown-platform");
  });
});

describe("agentLabel", () => {
  it("エージェント名を表示名に変換し、null は記録前にする", () => {
    expect(agentLabel("nepp-chan")).toBe("本体");
    expect(agentLabel("knowledge")).toBe("ナレッジ検索");
    expect(agentLabel(null)).toBe("記録前");
    expect(agentLabel("unknown-agent")).toBe("unknown-agent");
  });
});

describe("cacheRatePercent", () => {
  it("入力トークンに対するキャッシュ率を % で返す", () => {
    expect(
      cacheRatePercent({ inputTokens: 1000, cachedInputTokens: 600 }),
    ).toBe(60);
    expect(cacheRatePercent({ inputTokens: 0, cachedInputTokens: 0 })).toBe(0);
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
