import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentDateInfo } from "./date";

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
