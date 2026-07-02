import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mountWidget,
  onDocumentReady,
  resolveIconSrc,
  resolveIframeSrc,
} from "./loader";
import { CLOSE_MESSAGE_TYPE } from "./messages";

const WIDGET_FLAG = "__neppChatWidgetLoaded";
const SCRIPT_SRC = "https://nepp-chan.ai/widget/widget.js";
const IFRAME_SRC = "https://nepp-chan.ai/widget/";

const nextFrame = () =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve));

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
      iframeSrc: IFRAME_SRC,
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
    expect(iframe?.getAttribute("src")).toBe(IFRAME_SRC);
  });

  it("初回クリック直後は閉じた状態のスタイルで挿入する", () => {
    mount();
    document.body.querySelector("button")?.click();
    const iframe = document.body.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe?.style.visibility).toBe("hidden");
    expect(iframe?.style.opacity).toBe("0");
    expect(iframe?.style.pointerEvents).toBe("none");
  });

  it("transition に visibility を含め、close のフェードアウト中もパネルが見える", () => {
    mount();
    document.body.querySelector("button")?.click();
    const iframe = document.body.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe?.style.transition).toMatch(/visibility \d+ms/);
  });

  it("初回オープンは closed スタイルを reflow で確定させてから行う", async () => {
    const visibilityAtReflow: string[] = [];
    const spy = vi
      .spyOn(HTMLIFrameElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLIFrameElement) {
        visibilityAtReflow.push(this.style.visibility);
        return new DOMRect();
      });

    mount();
    document.body.querySelector("button")?.click();

    expect(visibilityAtReflow).toEqual(["hidden"]);

    await nextFrame();
    const iframe = document.body.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe?.style.visibility).toBe("visible");
    spy.mockRestore();
  });

  it("初回クリック直後は論理状態が open になり aria-expanded が true になる", () => {
    mount();
    const button = document.body.querySelector("button");
    button?.click();

    expect(button?.getAttribute("aria-expanded")).toBe("true");
  });

  it("rAF 発火前に 2 回クリックすると閉じた状態のまま aria-expanded が false になる", () => {
    mount();
    const button = document.body.querySelector("button");
    button?.click();
    button?.click();

    const iframe = document.body.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe?.style.visibility).toBe("hidden");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
  });

  it("初回クリック後、次フレームで開いた状態に遷移し aria-expanded も同期する", async () => {
    mount();
    const button = document.body.querySelector("button");
    button?.click();
    await nextFrame();

    const iframe = document.body.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe?.style.visibility).toBe("visible");
    expect(iframe?.style.opacity).toBe("1");
    expect(iframe?.style.pointerEvents).toBe("auto");
    expect(button?.getAttribute("aria-expanded")).toBe("true");
  });

  it("開いた状態からの再クリックで閉じ、visibility と aria-expanded が同期する", async () => {
    mount();
    const button = document.body.querySelector("button");
    button?.click();
    await nextFrame();

    button?.click();

    const iframe = document.body.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe?.style.visibility).toBe("hidden");
    expect(iframe?.style.opacity).toBe("0");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
  });

  describe("iframe からの close postMessage", () => {
    const openPanel = async () => {
      mount();
      const button = document.body.querySelector("button");
      button?.click();
      await nextFrame();
      return {
        button,
        iframe: document.body.querySelector<HTMLIFrameElement>("iframe"),
      };
    };

    const dispatchMessage = (
      iframe: HTMLIFrameElement | null,
      overrides: Partial<{ origin: string; source: unknown; data: unknown }>,
    ) => {
      const event = new MessageEvent("message", {
        origin: overrides.origin ?? new URL(IFRAME_SRC).origin,
        source:
          "source" in overrides
            ? (overrides.source as Window | null)
            : iframe?.contentWindow,
        data:
          "data" in overrides ? overrides.data : { type: CLOSE_MESSAGE_TYPE },
      });
      window.dispatchEvent(event);
    };

    it("正しい origin / source / type なら閉じる", async () => {
      const { button, iframe } = await openPanel();

      dispatchMessage(iframe, {});

      expect(iframe?.style.visibility).toBe("hidden");
      expect(button?.getAttribute("aria-expanded")).toBe("false");
    });

    it("origin が異なる場合は無視する", async () => {
      const { button, iframe } = await openPanel();

      dispatchMessage(iframe, { origin: "https://evil.example.com" });

      expect(iframe?.style.visibility).toBe("visible");
      expect(button?.getAttribute("aria-expanded")).toBe("true");
    });

    it("source が iframe の contentWindow と異なる場合は無視する", async () => {
      const { button, iframe } = await openPanel();

      dispatchMessage(iframe, { source: window });

      expect(iframe?.style.visibility).toBe("visible");
      expect(button?.getAttribute("aria-expanded")).toBe("true");
    });

    it("type が一致しない場合は無視する", async () => {
      const { button, iframe } = await openPanel();

      dispatchMessage(iframe, { data: { type: "other" } });

      expect(iframe?.style.visibility).toBe("visible");
      expect(button?.getAttribute("aria-expanded")).toBe("true");
    });
  });
});
