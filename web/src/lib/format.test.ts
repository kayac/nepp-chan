import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { formatDateTime } from "./format";

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

  describe("プロパティベース", () => {
    // TZ=Asia/Tokyo は package.json の test スクリプトで固定されている前提
    it("有効な ISO 文字列なら年/月/日/時/分の数字を含む", () => {
      fc.assert(
        fc.property(
          // 1970-2099 の任意 Date
          fc.date({
            min: new Date("1970-01-01T00:00:00Z"),
            max: new Date("2099-12-31T23:59:00Z"),
            noInvalidDate: true,
          }),
          (date) => {
            const result = formatDateTime(date.toISOString());
            // ja-JP の出力は "2025/03/15 09:05" のような形式
            expect(result).toMatch(/\d{4}/);
            expect(result).toMatch(/\d{2}:\d{2}/);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("同じ ISO 文字列を 2 回フォーマットしても同じ結果 (決定論的)", () => {
      fc.assert(
        fc.property(
          fc.date({
            min: new Date("2000-01-01T00:00:00Z"),
            max: new Date("2050-12-31T23:59:00Z"),
            noInvalidDate: true,
          }),
          (date) => {
            const iso = date.toISOString();
            expect(formatDateTime(iso)).toBe(formatDateTime(iso));
          },
        ),
        { numRuns: 50 },
      );
    });

    it("JST 換算で日付が一致する (TZ 越境ケース)", () => {
      fc.assert(
        fc.property(
          fc.date({
            min: new Date("2000-01-01T00:00:00Z"),
            max: new Date("2050-12-31T23:59:00Z"),
            noInvalidDate: true,
          }),
          (date) => {
            const result = formatDateTime(date.toISOString());
            // JST = UTC+9 で換算した日付が出力に含まれる
            const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
            const yyyy = String(jst.getUTCFullYear());
            const mm = String(jst.getUTCMonth() + 1).padStart(2, "0");
            const dd = String(jst.getUTCDate()).padStart(2, "0");
            expect(result).toContain(yyyy);
            expect(result).toContain(mm);
            expect(result).toContain(dd);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
