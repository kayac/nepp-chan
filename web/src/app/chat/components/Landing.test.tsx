import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Landing } from "./Landing";

describe("Landing", () => {
  it("クイックプロンプトを 4 件表示する", () => {
    render(<Landing onSubmit={vi.fn()} />);
    expect(screen.getByText(/音威子府村って、どんなところ？/)).toBeDefined();
    expect(screen.getByText(/名物の黒いお蕎麦について教えて/)).toBeDefined();
    expect(screen.getByText(/砂澤ビッキ記念館は？/)).toBeDefined();
    expect(screen.getByText(/冬の楽しみ方を教えて/)).toBeDefined();
  });

  it("クイックプロンプトクリックで onSubmit が呼ばれる", () => {
    const onSubmit = vi.fn();
    render(<Landing onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText(/音威子府村って、どんなところ？/));

    expect(onSubmit).toHaveBeenCalledWith("音威子府村って、どんなところ？");
  });

  it("テキスト送信で trim 後の値が onSubmit に渡る", () => {
    const onSubmit = vi.fn();
    render(<Landing onSubmit={onSubmit} />);

    const input = screen.getByLabelText("メッセージ入力") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  hi  " } });
    fireEvent.click(screen.getByLabelText("送信"));

    expect(onSubmit).toHaveBeenCalledWith("hi");
    expect(input.value).toBe("");
  });

  it("空文字送信は無視される", () => {
    const onSubmit = vi.fn();
    render(<Landing onSubmit={onSubmit} />);

    const input = screen.getByLabelText("メッセージ入力") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("disabled=true なら quick prompt クリックを無視", () => {
    const onSubmit = vi.fn();
    render(<Landing onSubmit={onSubmit} disabled />);

    fireEvent.click(screen.getByText(/冬の楽しみ方を教えて/));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
