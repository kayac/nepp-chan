import { describe, expect, it } from "vitest";

import { formatDateTime, formatMonthDayTime } from "./format";

describe("formatDateTime", () => {
  it("ISO 文字列を ja-JP の年/月/日 時:分 形式に整形する", () => {
    const result = formatDateTime("2025-03-15T09:05:00Z");
    expect(result).toMatch(/2025/);
    expect(result).toMatch(/03/);
    expect(result).toMatch(/15/);
  });

  it("時:分は 0 padding 付き", () => {
    const result = formatDateTime("2025-03-15T01:02:00+09:00");
    expect(result).toMatch(/01:02/);
  });

  it("無効な日付文字列でも throw しない（Invalid Date を返す）", () => {
    expect(() => formatDateTime("not-a-date")).not.toThrow();
  });
});

describe("formatMonthDayTime", () => {
  it("年を省いた月日と時刻に整形する", () => {
    const result = formatMonthDayTime("2026-07-27T18:00:00+09:00");
    expect(result).toContain("7月27日");
    expect(result).toContain("18:00");
    expect(result).not.toContain("2026");
  });
});
