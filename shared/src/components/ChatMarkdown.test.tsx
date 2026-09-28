import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMarkdown } from "./ChatMarkdown";

describe("ChatMarkdown", () => {
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

  it("user variant の水平線は白系クラスを持つ", () => {
    const { container } = render(
      <ChatMarkdown text={"一つ目\n\n---\n\n二つ目"} variant="user" />,
    );
    expect(container.querySelector("hr")?.className).toContain(
      "border-white/20",
    );
  });
});
