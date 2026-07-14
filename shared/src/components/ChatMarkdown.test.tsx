import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMarkdown } from "./ChatMarkdown";

describe("ChatMarkdown", () => {
  it("段落テキストをそのまま描画する", () => {
    render(<ChatMarkdown text="こんにちは" variant="assistant" />);
    expect(screen.getByText("こんにちは")).toBeTruthy();
  });

  it("リンクを新規タブで開き noopener noreferrer を付与する", () => {
    render(
      <ChatMarkdown
        text="[公式サイト](https://example.com)"
        variant="assistant"
      />,
    );
    const link = screen.getByRole("link", { name: "公式サイト" });
    expect(link.getAttribute("href")).toBe("https://example.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("assistant variant のリンクは brand 色クラスを持つ", () => {
    render(
      <ChatMarkdown text="[link](https://example.com)" variant="assistant" />,
    );
    const link = screen.getByRole("link");
    expect(link.className).toContain("text-(--brand)");
  });

  it("user variant のリンクは白系クラスを持つ", () => {
    render(<ChatMarkdown text="[link](https://example.com)" variant="user" />);
    const link = screen.getByRole("link");
    expect(link.className).toContain("text-white/90");
  });

  it("箇条書きリストを list / listitem として描画する", () => {
    render(<ChatMarkdown text={"- 一つ目\n- 二つ目"} variant="assistant" />);
    expect(screen.getByRole("list")).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("番号付きリストを描画する", () => {
    const { container } = render(
      <ChatMarkdown text={"1. 一つ目\n2. 二つ目"} variant="assistant" />,
    );
    expect(container.querySelector("ol")).not.toBeNull();
  });

  it("インラインコードとコードブロックを描画する", () => {
    const { container } = render(
      <ChatMarkdown text={"`inline`\n\n```\nblock\n```"} variant="assistant" />,
    );
    expect(container.querySelector("code")).not.toBeNull();
    expect(container.querySelector("pre")).not.toBeNull();
  });

  it("見出しを h1〜h3 として描画する", () => {
    const { container } = render(
      <ChatMarkdown text={"# 一\n## 二\n### 三"} variant="assistant" />,
    );
    expect(container.querySelector("h1")).not.toBeNull();
    expect(container.querySelector("h2")).not.toBeNull();
    expect(container.querySelector("h3")).not.toBeNull();
  });

  it("水平線を hr として描画する", () => {
    const { container } = render(
      <ChatMarkdown text={"一つ目\n\n---\n\n二つ目"} variant="assistant" />,
    );
    expect(container.querySelector("hr")).not.toBeNull();
  });

  it("user variant の水平線は白系クラスを持つ", () => {
    const { container } = render(
      <ChatMarkdown text={"一つ目\n\n---\n\n二つ目"} variant="user" />,
    );
    expect(container.querySelector("hr")?.className).toContain(
      "border-white/20",
    );
  });
});
