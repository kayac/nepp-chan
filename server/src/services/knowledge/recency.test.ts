import { describe, expect, it } from "vitest";
import { boostByRecency, recencyScore } from "./recency";

const now = new Date("2026-09-29T03:00:00Z");

describe("recencyScore", () => {
  it("当日の資料は 1", () => {
    expect(recencyScore("2026-09-29", "exact", now)).toBeCloseTo(1, 2);
  });

  it("未来日の資料は 1", () => {
    expect(recencyScore("2027-01-01", "exact", now)).toBe(1);
  });

  it("1 年前の資料は e^-1", () => {
    expect(recencyScore("2025-09-29", "observed", now)).toBeCloseTo(
      Math.exp(-1),
      2,
    );
  });

  it("evergreen は日付に関わらず 1", () => {
    expect(recencyScore("2001-01-01", "evergreen", now)).toBe(1);
    expect(recencyScore(undefined, "evergreen", now)).toBe(1);
  });

  it("date が無い、または日付として不正なら 0.5", () => {
    expect(recencyScore(undefined, "exact", now)).toBe(0.5);
    expect(recencyScore("不明", "exact", now)).toBe(0.5);
  });
});

describe("boostByRecency", () => {
  it("新しさを加点して降順に並べ、元の配列は変えない", () => {
    const items = [
      { id: "old", score: 0.8, date: "2020-01-01", dateType: "exact" },
      { id: "new", score: 0.75, date: "2026-09-01", dateType: "exact" },
    ];
    const boosted = boostByRecency(items, now, 0.15);

    expect(boosted.map((item) => item.id)).toEqual(["new", "old"]);
    expect(items[0].score).toBe(0.8);
    expect(boosted[0].score).toBeCloseTo(
      (0.75 + 0.15 * recencyScore("2026-09-01", "exact", now)) / 1.15,
      5,
    );
  });
});
