import { describe, expect, it } from "vitest";

import { formatError } from "./ErrorBanner";

describe("formatError", () => {
  it("Error インスタンスなら message を使う", () => {
    expect(formatError(new Error("取得に失敗しました"))).toBe(
      "エラー: 取得に失敗しました",
    );
  });

  it("Error インスタンスでなければ既定の fallback を使う", () => {
    expect(formatError("文字列エラー")).toBe("エラー: Unknown error");
  });

  it("fallback を指定できる", () => {
    expect(formatError("文字列エラー", "不明なエラー")).toBe(
      "エラー: 不明なエラー",
    );
  });
});
