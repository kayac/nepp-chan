import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BroadcastPartPreview } from "./BroadcastPartPreview";

describe("BroadcastPartPreview", () => {
  it("parts=null なら何も描画しない", () => {
    const { container } = render(<BroadcastPartPreview parts={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("不正な JSON なら描画しない", () => {
    const { container } = render(<BroadcastPartPreview parts="not-json" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("テキストパートのみなら描画しない", () => {
    const parts = JSON.stringify([{ type: "text", text: "hello" }]);
    const { container } = render(<BroadcastPartPreview parts={parts} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("画像パートを含むと img を全件描画", () => {
    const parts = JSON.stringify([
      { type: "text", text: "intro" },
      { type: "image", imageR2Key: "key-a" },
      { type: "image", imageR2Key: "key-b" },
    ]);
    const { container } = render(<BroadcastPartPreview parts={parts} />);

    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(2);
    expect(imgs[0].getAttribute("src")).toContain("key-a");
    expect(imgs[1].getAttribute("src")).toContain("key-b");
  });
});
