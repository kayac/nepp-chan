import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PartState } from "./helpers";
import { PartEditor } from "./PartEditor";

const textPart: PartState = { id: "p-1", type: "text", text: "" };
const filledTextPart: PartState = { id: "p-1", type: "text", text: "hello" };
const imagePartEmpty: PartState = { id: "p-2", type: "image", imageR2Key: "" };
const imagePartFilled: PartState = {
  id: "p-3",
  type: "image",
  imageR2Key: "key-x",
};

const renderEditor = (
  overrides: Partial<React.ComponentProps<typeof PartEditor>> = {},
) => {
  const props = {
    part: textPart,
    index: 0,
    total: 2,
    onChange: vi.fn(),
    onRemove: vi.fn(),
    onMove: vi.fn(),
    ...overrides,
  };
  return { ...render(<PartEditor {...props} />), props };
};

describe("PartEditor: テキストパート", () => {
  it("textarea 入力で onChange に新しい text を渡す", () => {
    const { props } = renderEditor();
    fireEvent.change(screen.getByPlaceholderText("テキストを入力"), {
      target: { value: "hi" },
    });
    expect(props.onChange).toHaveBeenCalledWith(0, {
      id: "p-1",
      type: "text",
      text: "hi",
    });
  });

  it("文字数カウンタを表示する", () => {
    renderEditor({ part: filledTextPart });
    expect(screen.getByText("5 / 5000")).toBeInTheDocument();
  });

  it("画像ボタンを押すと onChange で image パートに切り替わる", () => {
    const { props } = renderEditor();
    fireEvent.click(screen.getByText("画像"));
    expect(props.onChange).toHaveBeenCalledWith(0, {
      id: "p-1",
      type: "image",
      imageR2Key: "",
    });
  });

  it("内容があるテキストパートは画像ボタンが disabled", () => {
    renderEditor({ part: filledTextPart });
    expect(screen.getByText("画像").closest("button")).toBeDisabled();
  });
});

describe("PartEditor: 画像パート", () => {
  it("imageR2Key があれば img を表示", () => {
    renderEditor({ part: imagePartFilled });
    const img = screen.getByAltText("プレビュー");
    expect(img.getAttribute("src")).toContain("key-x");
  });

  it("imageR2Key が空ならアップロード CTA を表示", () => {
    renderEditor({ part: imagePartEmpty });
    expect(screen.getByText("写真をアップロード")).toBeInTheDocument();
  });
});

describe("PartEditor: 並び替え", () => {
  it("画像パートに切り替えた直後（imageR2Key 空）はテキストボタンも有効", () => {
    renderEditor({ part: imagePartEmpty });
    expect(screen.getByText("テキスト").closest("button")).not.toBeDisabled();
  });
});
