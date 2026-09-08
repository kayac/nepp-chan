import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FileInfo } from "~/types";
import { FileList } from "./FileList";

const info = (key: string): FileInfo => ({
  key,
  size: 1,
  lastModified: "2026-09-07T05:02:00Z",
});

const renderList = (
  files: FileInfo[],
  overrides: Partial<Parameters<typeof FileList>[0]> = {},
) => {
  const handlers = { onView: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
  render(
    <FileList
      files={files}
      loadMoreRef={vi.fn()}
      hasNextPage={false}
      isFetchingNextPage={false}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
};

const buttonsNamed = (name: string) =>
  screen.getAllByRole("button").filter((b) => b.textContent === name);

describe("FileList", () => {
  it("空なら emptyMessage を表示し、末尾表示は出さない", () => {
    renderList([], { emptyMessage: "まだありません" });
    expect(screen.getByText("まだありません")).toBeDefined();
    expect(screen.queryByText("すべてのファイルを表示しました")).toBeNull();
  });

  it("キーをディレクトリ部分とファイル名に分けて表示する", () => {
    renderList([info("official/otoko/access/bus-jikoku.md")]);
    expect(
      screen.getAllByText("official/otoko/access/").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("bus-jikoku.md").length).toBeGreaterThan(0);
  });

  it("閲覧・編集・削除はキーで呼ばれる", () => {
    const handlers = renderList([info("curated/usagi.md")]);

    fireEvent.click(buttonsNamed("閲覧")[0] as HTMLElement);
    fireEvent.click(buttonsNamed("編集")[0] as HTMLElement);
    fireEvent.click(buttonsNamed("削除")[0] as HTMLElement);

    expect(handlers.onView).toHaveBeenCalledWith("curated/usagi.md");
    expect(handlers.onEdit).toHaveBeenCalledWith("curated/usagi.md");
    expect(handlers.onDelete).toHaveBeenCalledWith("curated/usagi.md");
  });

  it("official 行は閲覧と削除だけ、旧配置の行は閲覧だけ", () => {
    renderList([info("official/kurashi/gomi.md")]);
    expect(buttonsNamed("閲覧")).toHaveLength(2);
    expect(buttonsNamed("編集")).toHaveLength(0);
    expect(buttonsNamed("削除")).toHaveLength(2);
  });

  it("curated/ official/ 以外の行には編集も削除も出ない", () => {
    renderList([info("villotoinep/index.md")]);
    expect(buttonsNamed("閲覧")).toHaveLength(2);
    expect(buttonsNamed("編集")).toHaveLength(0);
    expect(buttonsNamed("削除")).toHaveLength(0);
  });

  it("削除中は削除ボタンが無効になる", () => {
    renderList([info("official/a.md")], { isDeleting: true });
    for (const button of buttonsNamed("削除")) {
      expect(button).toBeDisabled();
    }
  });

  it("末尾は取得中なら読み込み中、次ページが無ければ完了表示", () => {
    const { rerender } = render(
      <FileList
        files={[info("official/a.md")]}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        loadMoreRef={vi.fn()}
        hasNextPage={true}
        isFetchingNextPage={true}
      />,
    );
    expect(screen.getByText("読み込み中...")).toBeDefined();
    expect(screen.queryByText("すべてのファイルを表示しました")).toBeNull();

    rerender(
      <FileList
        files={[info("official/a.md")]}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        loadMoreRef={vi.fn()}
        hasNextPage={false}
        isFetchingNextPage={false}
      />,
    );
    expect(screen.queryByText("読み込み中...")).toBeNull();
    expect(screen.getByText("すべてのファイルを表示しました")).toBeDefined();
  });

  it("末尾要素を loadMoreRef に渡す", () => {
    const loadMoreRef = vi.fn();
    renderList([info("official/a.md")], { loadMoreRef, hasNextPage: true });
    expect(loadMoreRef).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });
});
