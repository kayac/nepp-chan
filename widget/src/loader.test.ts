import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mountWidget,
  onDocumentReady,
  resolveIconSrc,
  resolveIframeSrc,
} from "./loader";

const WIDGET_FLAG = "__neppChatWidgetLoaded";
const SCRIPT_SRC = "https://nepp-chan.ai/widget/widget.js";

describe("resolveIframeSrc", () => {
  it("widget.js のディレクトリを iframe の src にする", () => {
    expect(resolveIframeSrc(SCRIPT_SRC)).toBe("https://nepp-chan.ai/widget/");
  });
});

describe("resolveIconSrc", () => {
  it("配信元の /mascot/icon.png を指す", () => {
    expect(resolveIconSrc(SCRIPT_SRC)).toBe(
      "https://nepp-chan.ai/mascot/icon.png",
    );
  });
});

describe("onDocumentReady", () => {
  afterEach(() => {
    Reflect.deleteProperty(document, "readyState");
  });

  it("DOM 構築完了後なら即座に実行する", () => {
    let called = 0;
    onDocumentReady(document, () => {
      called += 1;
    });
    expect(called).toBe(1);
  });

  it("DOM 構築中なら DOMContentLoaded まで遅らせて 1 回だけ実行する", () => {
    Object.defineProperty(document, "readyState", {
      configurable: true,
      get: () => "loading",
    });
    let called = 0;
    onDocumentReady(document, () => {
      called += 1;
    });
    expect(called).toBe(0);
    document.dispatchEvent(new Event("DOMContentLoaded"));
    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(called).toBe(1);
  });
});

describe("mountWidget", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    delete (window as unknown as Record<string, unknown>)[WIDGET_FLAG];
  });

  const mount = () =>
    mountWidget({
      iframeSrc: "https://nepp-chan.ai/widget/",
      iconSrc: "https://nepp-chan.ai/mascot/icon.png",
    });

  it("起動ボタンを body に 1 つ追加する", () => {
    mount();
    const buttons = document.body.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("aria-label")).toBeTruthy();
  });

  it("二重ロードしてもボタンは 1 つ", () => {
    mount();
    mount();
    expect(document.body.querySelectorAll("button")).toHaveLength(1);
  });

  it("初回クリックまで iframe を生成しない", () => {
    mount();
    expect(document.body.querySelector("iframe")).toBeNull();
  });

  it("クリックで iframe を生成し src を設定する", () => {
    mount();
    document.body.querySelector("button")?.click();
    const iframe = document.body.querySelector("iframe");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("src")).toBe("https://nepp-chan.ai/widget/");
  });

  it("再クリックでパネルを閉じる", () => {
    mount();
    const button = document.body.querySelector("button");
    button?.click();
    button?.click();
    const iframe = document.body.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe?.style.display).toBe("none");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
  });
});
