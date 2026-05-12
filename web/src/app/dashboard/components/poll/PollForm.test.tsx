import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { renderWithQuery } from "~/test/query";
import { PollForm } from "./PollForm";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("PollForm", () => {
  it("新規モードで『新規作成』を表示", () => {
    renderWithQuery(<PollForm onClose={vi.fn()} />);
    expect(screen.getByText("新規作成")).toBeInTheDocument();
  });

  it("編集モードで『投票を編集』を表示", () => {
    renderWithQuery(
      <PollForm
        poll={{
          id: "p-1",
          title: "Q",
          choices: ["A", "B"],
          followUpPrompt: null,
          status: "draft",
          createdBy: "admin",
          createdAt: "2030-01-01T00:00:00.000Z",
          updatedAt: null,
          scheduledAt: null,
          sentAt: null,
          closedAt: null,
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("投票を編集")).toBeInTheDocument();
  });

  it("『選択肢を追加』で input が増える", () => {
    renderWithQuery(<PollForm onClose={vi.fn()} />);
    const before = screen.getAllByPlaceholderText("選択肢を入力").length;
    fireEvent.click(screen.getByText("選択肢を追加"));
    expect(screen.getAllByPlaceholderText("選択肢を入力")).toHaveLength(
      before + 1,
    );
  });

  it("閉じるボタンで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    renderWithQuery(<PollForm onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalled();
  });

  it("初期状態は『投票を開始』が disabled", () => {
    renderWithQuery(<PollForm onClose={vi.fn()} />);
    expect(screen.getByText("投票を開始").closest("button")).toBeDisabled();
  });
});
