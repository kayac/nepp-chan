import { describe, expect, it } from "vitest";
import { splitSearchKeywords } from "./search-keywords";

describe("splitSearchKeywords", () => {
  it("空白区切りでキーワードに分割する", () => {
    expect(splitSearchKeywords("そば 観光")).toEqual(["そば", "観光"]);
  });

  it("全角スペース・連続空白・前後空白を無視する", () => {
    expect(splitSearchKeywords("  そば　 観光  ")).toEqual(["そば", "観光"]);
  });

  it("既定で先頭 5 語までに制限する", () => {
    expect(splitSearchKeywords("a b c d e f g")).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("limit 指定で語数を変えられる", () => {
    expect(splitSearchKeywords("a b c", 2)).toEqual(["a", "b"]);
  });

  it("空文字列なら空配列を返す", () => {
    expect(splitSearchKeywords("")).toEqual([]);
  });
});
