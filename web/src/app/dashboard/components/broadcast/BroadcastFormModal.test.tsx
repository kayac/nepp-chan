import { fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuthToken } from "~/lib/auth-token";
import { renderWithQuery } from "~/test/query";
import { BroadcastFormModal } from "./BroadcastFormModal";

beforeEach(() => {
  localStorage.clear();
  setAuthToken("admin-token");
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("BroadcastFormModal", () => {
  it("create モードで『新規配信作成』を表示", () => {
    renderWithQuery(<BroadcastFormModal mode="create" onClose={vi.fn()} />);
    expect(screen.getByText("新規配信作成")).toBeInTheDocument();
  });

  it("edit モードで『配信を編集』を表示", () => {
    renderWithQuery(
      <BroadcastFormModal
        mode="edit"
        broadcast={{
          id: "b-1",
          title: "x",
          body: "hello",
          parts: null,
          status: "draft",
          scheduledAt: null,
          sentAt: null,
          errorMessage: null,
          createdBy: "admin",
          createdAt: "2030-01-01T00:00:00.000Z",
          updatedAt: null,
        }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("配信を編集")).toBeInTheDocument();
  });

  it("背景の閉じるボタンをクリックで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    renderWithQuery(<BroadcastFormModal mode="create" onClose={onClose} />);

    const closeButtons = screen.getAllByLabelText("閉じる");
    fireEvent.click(closeButtons[0]);

    expect(onClose).toHaveBeenCalled();
  });

  it("初期状態では送信ボタンが disabled", () => {
    renderWithQuery(<BroadcastFormModal mode="create" onClose={vi.fn()} />);
    expect(screen.getByText("送信する").closest("button")).toBeDisabled();
  });

  it("スケジュールタブに切り替えると datetime-local 入力が出る", () => {
    renderWithQuery(<BroadcastFormModal mode="create" onClose={vi.fn()} />);

    fireEvent.click(screen.getByText("スケジュール"));

    expect(screen.getByLabelText("配信日時")).toBeInTheDocument();
  });
});
