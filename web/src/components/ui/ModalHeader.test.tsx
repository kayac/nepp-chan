import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModalHeader } from "./ModalHeader";

describe("ModalHeader", () => {
  it("title を表示する", () => {
    render(<ModalHeader title="投票結果" onClose={vi.fn()} />);

    expect(screen.getByText("投票結果")).toBeInTheDocument();
  });

  it("閉じるボタンクリックで onClose を呼ぶ", () => {
    const onClose = vi.fn();
    render(<ModalHeader title="投票結果" onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("閉じる"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("description があれば表示する", () => {
    render(
      <ModalHeader
        title="新規作成"
        description="何を聞きますか？"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("何を聞きますか？")).toBeInTheDocument();
  });

  it("description がなければ表示しない", () => {
    const { container } = render(
      <ModalHeader title="投票結果" onClose={vi.fn()} />,
    );

    expect(container.querySelector("p")).toBeNull();
  });
});
