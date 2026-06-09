import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("プレビュー右上の X ボタンで imageR2Key をクリア", () => {
    const { props, container } = renderEditor({ part: imagePartFilled });
    // プレビューの absolute 位置の X ボタンは class top-1 right-1 で識別
    const clearBtn = container.querySelector<HTMLButtonElement>(
      "button.absolute.top-1.right-1",
    );
    if (!clearBtn) throw new Error("クリアボタンが見つかりません");
    fireEvent.click(clearBtn);
    expect(props.onChange).toHaveBeenCalledWith(0, {
      id: "p-3",
      type: "image",
      imageR2Key: "",
    });
  });

  it("既にテキストパートでテキストボタンを押しても onChange を呼ばない", () => {
    const { props } = renderEditor({ part: textPart });
    fireEvent.click(screen.getByText("テキスト"));
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("既に画像パートで画像ボタンを押しても onChange を呼ばない", () => {
    const { props } = renderEditor({ part: imagePartEmpty });
    fireEvent.click(screen.getByText("画像"));
    expect(props.onChange).not.toHaveBeenCalled();
  });
});

describe("PartEditor: 画像アップロード", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview-url"),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const selectFile = (container: HTMLElement, file: File) => {
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("file input が見つかりません");
    fireEvent.change(input, { target: { files: [file] } });
  };

  it("ファイル選択で onChange に image + file + previewUrl を渡す", () => {
    const { props, container } = renderEditor({ part: imagePartEmpty });
    const file = new File(["x"], "photo.png", { type: "image/png" });
    selectFile(container, file);
    expect(props.onChange).toHaveBeenCalledWith(0, {
      id: "p-2",
      type: "image",
      imageR2Key: "",
      file,
      previewUrl: "blob:preview-url",
    });
  });

  it("ファイルが選択されなければ onChange を呼ばない", () => {
    const { props, container } = renderEditor({ part: imagePartEmpty });
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("file input が見つかりません");
    fireEvent.change(input, { target: { files: [] } });
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it("アップロード CTA を押すと file input を click する", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    renderEditor({ part: imagePartEmpty });
    fireEvent.click(screen.getByText("写真をアップロード"));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});

describe("PartEditor: 画像パートのプレビュー分岐", () => {
  it("previewUrl があれば img の src に previewUrl を使う", () => {
    const part: PartState = {
      id: "p-4",
      type: "image",
      imageR2Key: "",
      file: new File(["x"], "p.png", { type: "image/png" }),
      previewUrl: "blob:local-preview",
    };
    renderEditor({ part });
    expect(screen.getByAltText("プレビュー").getAttribute("src")).toBe(
      "blob:local-preview",
    );
  });

  it("file 付きの画像パートはテキストボタンが disabled", () => {
    const part: PartState = {
      id: "p-5",
      type: "image",
      imageR2Key: "",
      file: new File(["x"], "p.png", { type: "image/png" }),
      previewUrl: "blob:local-preview",
    };
    renderEditor({ part });
    expect(screen.getByText("テキスト").closest("button")).toBeDisabled();
  });
});

describe("PartEditor: 並び替え・削除", () => {
  const moveUpBtn = (container: HTMLElement) =>
    container.querySelectorAll<HTMLButtonElement>(
      ".items-center.gap-0\\.5 > button",
    )[0];
  const moveDownBtn = (container: HTMLElement) =>
    container.querySelectorAll<HTMLButtonElement>(
      ".items-center.gap-0\\.5 > button",
    )[1];
  const removeBtn = (container: HTMLElement) =>
    container.querySelectorAll<HTMLButtonElement>(
      ".items-center.gap-0\\.5 > button",
    )[2];

  it("上移動ボタンで onMove(index, 'up') を呼ぶ", () => {
    const { props, container } = renderEditor({ index: 1, total: 3 });
    fireEvent.click(moveUpBtn(container));
    expect(props.onMove).toHaveBeenCalledWith(1, "up");
  });

  it("下移動ボタンで onMove(index, 'down') を呼ぶ", () => {
    const { props, container } = renderEditor({ index: 1, total: 3 });
    fireEvent.click(moveDownBtn(container));
    expect(props.onMove).toHaveBeenCalledWith(1, "down");
  });

  it("先頭パートは上移動ボタンが disabled", () => {
    const { container } = renderEditor({ index: 0, total: 3 });
    expect(moveUpBtn(container)).toBeDisabled();
    expect(moveDownBtn(container)).not.toBeDisabled();
  });

  it("末尾パートは下移動ボタンが disabled", () => {
    const { container } = renderEditor({ index: 2, total: 3 });
    expect(moveDownBtn(container)).toBeDisabled();
    expect(moveUpBtn(container)).not.toBeDisabled();
  });

  it("削除ボタンで onRemove(index) を呼ぶ", () => {
    const { props, container } = renderEditor({ index: 1, total: 3 });
    fireEvent.click(removeBtn(container));
    expect(props.onRemove).toHaveBeenCalledWith(1);
  });

  it("パートが 1 件のみなら削除ボタンが disabled", () => {
    const { container } = renderEditor({ index: 0, total: 1 });
    expect(removeBtn(container)).toBeDisabled();
  });

  it("画像パートに切り替えた直後（imageR2Key 空）はテキストボタンも有効", () => {
    renderEditor({ part: imagePartEmpty });
    expect(screen.getByText("テキスト").closest("button")).not.toBeDisabled();
  });
});
