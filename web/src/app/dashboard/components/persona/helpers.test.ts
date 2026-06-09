import { describe, expect, it } from "vitest";

import { getSentimentStyle } from "./helpers";

describe("getSentimentStyle", () => {
  it("null や空文字なら空文字", () => {
    expect(getSentimentStyle(null)).toBe("");
    expect(getSentimentStyle("")).toBe("");
  });

  it("positive は緑系", () => {
    expect(getSentimentStyle("positive")).toBe("bg-green-50 text-green-700");
  });

  it("negative は赤系", () => {
    expect(getSentimentStyle("negative")).toBe("bg-red-50 text-red-700");
  });

  it("request はアンバー系", () => {
    expect(getSentimentStyle("request")).toBe("bg-amber-50 text-amber-700");
  });

  it("未知の値は stone デフォルト", () => {
    expect(getSentimentStyle("unknown")).toBe("bg-stone-100 text-stone-600");
  });
});
