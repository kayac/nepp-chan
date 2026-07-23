import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ErrorBanner, formatError } from "./ErrorBanner";

describe("ErrorBanner", () => {
  it("children を表示する", () => {
    render(<ErrorBanner>エラー: 何かがおかしい</ErrorBanner>);

    expect(screen.getByText("エラー: 何かがおかしい")).toBeInTheDocument();
  });
});

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
