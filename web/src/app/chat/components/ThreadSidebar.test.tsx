import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Thread } from "~/types";
import { ThreadSidebar } from "./ThreadSidebar";

const threads: Thread[] = [
  {
    id: "t-1",
    resourceId: "r",
    title: "最初の会話",
    createdAt: "2030-01-01T00:00:00Z",
    updatedAt: "2030-01-01T00:00:00Z",
    metadata: null,
  },
  {
    id: "t-2",
    resourceId: "r",
    title: null,
    createdAt: "2030-01-02T00:00:00Z",
    updatedAt: "2030-01-02T00:00:00Z",
    metadata: null,
  },
];

const baseProps = {
  isOpen: true,
  threads,
  currentThreadId: "t-1",
  isCreating: false,
  onClose: vi.fn(),
  onNewThread: vi.fn(),
  onSelectThread: vi.fn(),
  onRequestDelete: vi.fn(),
};

describe("ThreadSidebar", () => {
  it("スレッド一覧を描画（タイトル無しは『新しい会話』）", () => {
    render(<ThreadSidebar {...baseProps} />);
    expect(screen.getByText("最初の会話")).toBeInTheDocument();
    expect(screen.getAllByText("新しい会話")).toHaveLength(2);
  });

  it("選択ボタンで onSelectThread", () => {
    const onSelectThread = vi.fn();
    render(<ThreadSidebar {...baseProps} onSelectThread={onSelectThread} />);
    fireEvent.click(screen.getByText("最初の会話"));
    expect(onSelectThread).toHaveBeenCalledWith("t-1");
  });

  it("削除ボタンで onRequestDelete", () => {
    const onRequestDelete = vi.fn();
    render(<ThreadSidebar {...baseProps} onRequestDelete={onRequestDelete} />);
    fireEvent.click(screen.getAllByLabelText("スレッドを削除")[0]);
    expect(onRequestDelete).toHaveBeenCalledWith("t-1");
  });

  it("『新しい会話』ボタンで onNewThread", () => {
    const onNewThread = vi.fn();
    render(<ThreadSidebar {...baseProps} onNewThread={onNewThread} />);
    fireEvent.click(screen.getAllByText("新しい会話")[0]);
    expect(onNewThread).toHaveBeenCalled();
  });

  it("isCreating=true で新しい会話ボタンが disabled", () => {
    render(<ThreadSidebar {...baseProps} isCreating />);
    const buttons = screen.getAllByRole("button");
    const createBtn = buttons.find((b) => b.disabled);
    expect(createBtn).toBeDefined();
  });
});
