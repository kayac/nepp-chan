import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalContent } from "./LegalContent";

const markdown = `## 第１条　はじめに

これは **強調** された段落です。

- 箇条書き 1
- 箇条書き 2

| 項目 | 内容 |
| --- | --- |
| LINE | LINE のユーザー識別子 |
| Web | 匿名のランダム文字列 |

詳細は [カヤック](https://www.kayac.com/) をご確認ください。
`;

describe("LegalContent", () => {
  it("タイトルを h1 で表示する", () => {
    render(<LegalContent title="プライバシーポリシー" content={markdown} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "プライバシーポリシー" }),
    ).toBeInTheDocument();
  });

  it("Markdown 見出しを h2 として描画する", () => {
    render(<LegalContent title="プライバシーポリシー" content={markdown} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "第１条　はじめに" }),
    ).toBeInTheDocument();
  });

  it("リンクを a 要素として描画する", () => {
    render(<LegalContent title="プライバシーポリシー" content={markdown} />);
    const link = screen.getByRole("link", { name: "カヤック" });
    expect(link).toHaveAttribute("href", "https://www.kayac.com/");
  });

  it("remark-gfm のテーブル記法を table 要素に変換する", () => {
    render(<LegalContent title="プライバシーポリシー" content={markdown} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("LINE")).toBeInTheDocument();
    expect(within(table).getByText("匿名のランダム文字列")).toBeInTheDocument();
  });

  it("箇条書きを li として展開する", () => {
    render(<LegalContent title="プライバシーポリシー" content={markdown} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(
      expect.arrayContaining(["箇条書き 1", "箇条書き 2"]),
    );
  });
});
