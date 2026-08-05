import { describe, expect, it } from "vitest";
import { startOfWeek, toDateString } from "./date";

describe("toDateString", () => {
  it("ローカルタイムの YYYY-MM-DD に整形する", () => {
    expect(toDateString(new Date("2026-07-29T10:00:00"))).toBe("2026-07-29");
    expect(toDateString(new Date("2026-01-05T00:00:00"))).toBe("2026-01-05");
  });
});

describe("startOfWeek", () => {
  it("水曜日なら同じ週の月曜日を返す", () => {
    expect(toDateString(startOfWeek(new Date("2026-07-29T10:00:00")))).toBe(
      "2026-07-27",
    );
  });

  it("月曜日はその日のまま", () => {
    expect(toDateString(startOfWeek(new Date("2026-07-27T00:30:00")))).toBe(
      "2026-07-27",
    );
  });

  it("日曜日は前週扱いにしない（同じ週の月曜起点）", () => {
    expect(toDateString(startOfWeek(new Date("2026-08-02T23:00:00")))).toBe(
      "2026-07-27",
    );
  });
});
