import { describe, expect, it } from "vitest";

import { periodRange, rollingFrom } from "./voice-period";

// 2026-08-03（月）
const NOW = new Date("2026-08-03T10:00:00");

describe("rollingFrom", () => {
  it("今日を含む日数で遡る", () => {
    expect(rollingFrom(NOW, 7)).toBe("2026-07-28");
    expect(rollingFrom(NOW, 1)).toBe("2026-08-03");
  });

  it("月をまたいで遡れる", () => {
    expect(rollingFrom(NOW, 30)).toBe("2026-07-05");
  });
});

describe("periodRange", () => {
  it("d7 は今日を含む 7 日", () => {
    expect(periodRange("d7", NOW)).toEqual({ from: "2026-07-28" });
  });

  it("m1 は今日を含む 30 日", () => {
    expect(periodRange("m1", NOW)).toEqual({ from: "2026-07-05" });
  });

  it("all は期間条件なし", () => {
    expect(periodRange("all", NOW)).toEqual({});
  });

  it("月曜でも直前の週末を含む（暦週なら空になる日）", () => {
    // 月曜起点の暦週だと当日のみになるが、ローリングなら土日を含む
    expect(periodRange("d7", NOW).from).toBe("2026-07-28");
  });
});
