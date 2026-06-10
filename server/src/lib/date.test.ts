import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentDateInfo,
  jstDateLabel,
  startOfJstDay,
  startOfJstWeek,
} from "./date";

describe("getCurrentDateInfo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("JST フォーマットの日時文字列を返す", () => {
    // 2030-03-15 12:34 UTC = 2030-03-15 21:34 JST
    vi.setSystemTime(new Date("2030-03-15T12:34:00Z"));

    const result = getCurrentDateInfo();

    expect(result).toContain("2030年");
    expect(result).toContain("3月15日");
    expect(result).toContain("21:34");
    expect(result).toMatch(/^今日は.+、現在.+です。$/);
  });

  it("日付が変わると出力も変わる", () => {
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const a = getCurrentDateInfo();
    vi.setSystemTime(new Date("2030-12-31T23:59:00Z"));
    const b = getCurrentDateInfo();
    expect(a).not.toBe(b);
  });
});

describe("startOfJstDay", () => {
  it("JST のその日 00:00 を UTC で返す", () => {
    // UTC 2026-06-09 16:00 = JST 2026-06-10 01:00 → JST 06-10 00:00 = UTC 06-09 15:00
    const result = startOfJstDay(new Date("2026-06-09T16:00:00.000Z"));
    expect(result.toISOString()).toBe("2026-06-09T15:00:00.000Z");
  });

  it("UTC では前日でも JST の日付で切る", () => {
    // UTC 2026-06-09 14:59 = JST 2026-06-09 23:59 → JST 06-09 00:00 = UTC 06-08 15:00
    const result = startOfJstDay(new Date("2026-06-09T14:59:00.000Z"));
    expect(result.toISOString()).toBe("2026-06-08T15:00:00.000Z");
  });
});

describe("startOfJstWeek", () => {
  it("水曜は同じ週の月曜 00:00 JST を返す", () => {
    // JST 2026-06-10(水) → 月曜 06-08 00:00 JST = UTC 06-07 15:00
    const result = startOfJstWeek(new Date("2026-06-10T02:00:00.000Z"));
    expect(result.toISOString()).toBe("2026-06-07T15:00:00.000Z");
  });

  it("月曜 00:00 JST ちょうどはその日を返す", () => {
    const result = startOfJstWeek(new Date("2026-06-07T15:00:00.000Z"));
    expect(result.toISOString()).toBe("2026-06-07T15:00:00.000Z");
  });

  it("日曜は前の月曜を返す", () => {
    // JST 2026-06-14(日) 23:00 → 月曜 06-08
    const result = startOfJstWeek(new Date("2026-06-14T14:00:00.000Z"));
    expect(result.toISOString()).toBe("2026-06-07T15:00:00.000Z");
  });
});

describe("jstDateLabel", () => {
  it("UTC 時刻を JST の YYYY-MM-DD に変換する", () => {
    expect(jstDateLabel(new Date("2026-06-09T15:00:00.000Z"))).toBe(
      "2026-06-10",
    );
    expect(jstDateLabel(new Date("2026-06-09T14:59:00.000Z"))).toBe(
      "2026-06-09",
    );
  });
});
