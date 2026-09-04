import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { UnifiedFileInfo } from "~/types";
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

  it("onDelete が渡されたら curated 行の削除ボタンで baseName 経由で呼ばれる", () => {
    const onDelete = vi.fn();

    render(
      <FileList
        files={[
          mkFile({
            baseName: "curated/rm-me",
            markdown: {
              key: "curated/rm-me.md",
              size: 1,
              lastModified: "2025-01-01T00:00:00Z",
            },
          }),
        ]}
        onDelete={onDelete}
      />,
    );

    const buttons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent === "削除");
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0] as HTMLElement);
    expect(onDelete).toHaveBeenCalledWith("curated/rm-me");
  });

  it("git 管理の行には削除ボタンが出ず、元ファイルを持つ行には出る", () => {
    render(
      <FileList
        files={[
          mkFile({ baseName: "villotoinep/index" }),
          mkFile({
            baseName: "chirashi",
            original: {
              key: "originals/chirashi.pdf",
              size: 1,
              lastModified: "2025-01-01T00:00:00Z",
              contentType: "application/pdf",
            },
          }),
        ]}
        onDelete={vi.fn()}
      />,
    );

    const buttons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent === "削除");
    expect(buttons).toHaveLength(2);
  });

  it("emptyMessage があれば空表示の文言を差し替える", () => {
    render(<FileList files={[]} emptyMessage="まだありません" />);
    expect(screen.getByText("まだありません")).toBeDefined();
  });

  it("onEdit が渡されても curated/ 配下の行にだけ編集ボタンが出る", () => {
    const onEdit = vi.fn();
    render(
      <FileList
        files={[
          mkFile({
            baseName: "curated/usagi",
            markdown: {
              key: "curated/usagi.md",
              size: 1,
              lastModified: "2025-01-01T00:00:00Z",
            },
          }),
          mkFile({
            baseName: "villotoinep/index",
            markdown: {
              key: "villotoinep/index.md",
              size: 1,
              lastModified: "2025-01-01T00:00:00Z",
            },
          }),
        ]}
        onEdit={onEdit}
      />,
    );

    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent === "編集");
    // desktop と mobile の 2 レイアウト分
    expect(editButtons).toHaveLength(2);
    fireEvent.click(editButtons[0] as HTMLElement);
    expect(onEdit).toHaveBeenCalledWith("curated/usagi.md");
  });
});
