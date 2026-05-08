import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConvertDialog } from "./ConvertDialog";

const buildFile = (
  name = "report.pdf",
  type = "application/pdf",
  size = 2048,
) => new File([new Uint8Array(size)], name, { type });

describe("ConvertDialog", () => {
  it("元ファイル名から拡張子を除いた値が初期値", () => {
    render(
      <ConvertDialog
        file={buildFile("report.pdf")}
        onConvert={vi.fn()}
        onCancel={vi.fn()}
        isConverting={false}
      />,
    );
    const input = screen.getByLabelText(
      "保存するファイル名",
    ) as HTMLInputElement;
    expect(input.value).toBe("report");
  });

  it("ファイル情報（名前・形式・サイズ）を表示する", () => {
    render(
      <ConvertDialog
        file={buildFile("foo.pdf", "application/pdf", 5120)}
        onConvert={vi.fn()}
        onCancel={vi.fn()}
        isConverting={false}
      />,
    );
    expect(screen.getByText(/foo\.pdf/)).toBeDefined();
    expect(screen.getByText(/application\/pdf/)).toBeDefined();
    expect(screen.getByText(/5\.0 KB/)).toBeDefined();
  });

  it("送信時に trim 済みファイル名が onConvert に渡る", () => {
    const onConvert = vi.fn();
    render(
      <ConvertDialog
        file={buildFile()}
        onConvert={onConvert}
        onCancel={vi.fn()}
        isConverting={false}
      />,
    );

    const input = screen.getByLabelText(
      "保存するファイル名",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  newname  " } });
    fireEvent.click(screen.getByRole("button", { name: "変換して保存" }));

    expect(onConvert).toHaveBeenCalledWith("newname");
  });

  it("キャンセルボタンで onCancel", () => {
    const onCancel = vi.fn();
    render(
      <ConvertDialog
        file={buildFile()}
        onConvert={vi.fn()}
        onCancel={onCancel}
        isConverting={false}
      />,
    );
    fireEvent.click(screen.getByText("キャンセル"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("isConverting=true は『変換中...』とボタン無効化", () => {
    render(
      <ConvertDialog
        file={buildFile()}
        onConvert={vi.fn()}
        onCancel={vi.fn()}
        isConverting
      />,
    );
    expect(screen.getByText("変換中...")).toBeDefined();
    expect(
      (screen.getByLabelText("保存するファイル名") as HTMLInputElement)
        .disabled,
    ).toBe(true);
  });

  it("ファイル名が空白だけなら送信ボタンが無効", () => {
    render(
      <ConvertDialog
        file={buildFile()}
        onConvert={vi.fn()}
        onCancel={vi.fn()}
        isConverting={false}
      />,
    );

    const input = screen.getByLabelText(
      "保存するファイル名",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });

    expect(
      screen
        .getByRole("button", { name: "変換して保存" })
        .hasAttribute("disabled"),
    ).toBe(true);
  });
});
