import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MarkdownText } from "./MarkdownText";

describe("MarkdownText", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("見出し・段落・リンクを描画する", () => {
    render(
      <MarkdownText text={"# 見出し\n\n本文と[リンク](https://example.com)"} />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "見出し" }),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "リンク" });
    expect(link).toHaveAttribute("href", "https://example.com");
  });

  it("インラインコードには inline-code クラスを付ける", () => {
    const { container } = render(
      <MarkdownText text={"これは `inline` です"} />,
    );

    const code = container.querySelector("code");
    expect(code).not.toBeNull();
    expect(code?.className).toContain("aui-md-inline-code");
  });

  it("コードブロックは言語を表示し、コピーボタンを持つ", async () => {
    render(<MarkdownText text={"```ts\nconst a = 1;\n```"} />);

    expect(screen.getByText("ts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    // コードブロック内の code には inline-code クラスを付けない
    const blockCode = screen.getByText(/const a = 1;/);
    expect(blockCode.className).not.toContain("aui-md-inline-code");
  });

  it("コピーボタンでコードをクリップボードに書き込む", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<MarkdownText text={"```ts\nconst a = 1;\n```"} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("const a = 1;\n");
  });

  it("言語指定のないコードブロックもコピーできる", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<MarkdownText text={"```\nplain code\n```"} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("plain code\n");
  });

  it("空のコードブロックではコピーを実行しない", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<MarkdownText text={"```\n\n```"} />);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).not.toHaveBeenCalled();
  });

  it("見出し・引用・リスト・水平線・表・脚注を描画する", () => {
    const md = `## H2
### H3
#### H4
##### H5
###### H6

> 引用文

- 項目A
- 項目B

1. 1番目
2. 2番目

---

| 列1 | 列2 |
| --- | --- |
| a | b |

脚注[^1]

[^1]: 注釈テキスト`;
    render(<MarkdownText text={md} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "H2" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 6, name: "H6" }),
    ).toBeInTheDocument();
    expect(screen.getByText("引用文")).toBeInTheDocument();
    expect(screen.getByText("項目A")).toBeInTheDocument();
    expect(screen.getByText("1番目")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "列1" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "a" })).toBeInTheDocument();
  });

  it("約物に隣接する強調を CJK 文中で描画する", () => {
    const { container } = render(
      <MarkdownText
        text={"村は**「まち」「ひと」「しごと」**の三本柱で進めています"}
      />,
    );

    expect(container.querySelector("strong")?.textContent).toBe(
      "「まち」「ひと」「しごと」",
    );
  });

  it("閉じ括弧の直後で強調を閉じられる", () => {
    const { container } = render(
      <MarkdownText
        text={"**住民課住民生活室（Tel:01656-5-3312）**が窓口です"}
      />,
    );

    expect(container.querySelector("strong")?.textContent).toBe(
      "住民課住民生活室（Tel:01656-5-3312）",
    );
  });
});
