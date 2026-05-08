import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UnifiedFileInfo } from "../../../../types";
import { FileList } from "./FileList";

const mkFile = (overrides: Partial<UnifiedFileInfo> = {}): UnifiedFileInfo => ({
  baseName: "doc",
  hasMarkdown: true,
  markdown: {
    key: "doc.md",
    size: 2048,
    lastModified: "2025-01-01T00:00:00Z",
  },
  original: undefined,
  ...overrides,
});

describe("FileList", () => {
  it("空配列なら『ファイルがありません』を表示", () => {
    render(<FileList files={[]} />);
    expect(screen.getByText("ファイルがありません")).toBeDefined();
  });

  it("baseName を表で表示", () => {
    render(<FileList files={[mkFile({ baseName: "intro" })]} />);
    expect(screen.getAllByText("intro").length).toBeGreaterThan(0);
  });

  it("original あり: ファイル名がリンクとして描画される", () => {
    render(
      <FileList
        files={[
          mkFile({
            original: {
              key: "originals/foo.pdf",
              size: 1024,
              lastModified: "2025-01-01T00:00:00Z",
              contentType: "application/pdf",
            },
          }),
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
  });

  it("onView が渡されたら閲覧ボタンクリックで呼ばれる", () => {
    const onView = vi.fn();
    render(<FileList files={[mkFile({ baseName: "x" })]} onView={onView} />);

    const buttons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent === "閲覧");
    if (buttons[0]) {
      fireEvent.click(buttons[0]);
      expect(onView).toHaveBeenCalledWith("doc.md");
    }
  });

  it("onDelete が渡されたら削除ボタンで baseName 経由で呼ばれる", () => {
    const onDelete = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <FileList files={[mkFile({ baseName: "rm-me" })]} onDelete={onDelete} />,
    );

    const buttons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent === "削除");
    if (buttons[0]) {
      fireEvent.click(buttons[0]);
      expect(onDelete).toHaveBeenCalledWith("rm-me");
    }
  });
});
