import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStickToBottom } from "./useStickToBottom";

const setScrollMetrics = (
  el: HTMLElement,
  metrics: { scrollHeight: number; clientHeight: number; scrollTop: number },
) => {
  Object.defineProperty(el, "scrollHeight", {
    value: metrics.scrollHeight,
    configurable: true,
  });
  Object.defineProperty(el, "clientHeight", {
    value: metrics.clientHeight,
    configurable: true,
  });
  Object.defineProperty(el, "scrollTop", {
    value: metrics.scrollTop,
    writable: true,
    configurable: true,
  });
};

const TestView = ({ dep }: { dep: unknown }) => {
  const { viewportRef, isAtBottom, scrollToBottom } = useStickToBottom(dep);
  return (
    <>
      <div data-testid="vp" ref={viewportRef} />
      <span data-testid="state">{String(isAtBottom)}</span>
      <button type="button" onClick={() => scrollToBottom()}>
        to-bottom
      </button>
    </>
  );
};

let resizeCallback: () => void = () => {};

describe("useStickToBottom", () => {
  beforeEach(() => {
    resizeCallback = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          resizeCallback = cb;
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("初期状態は最下部とみなす", () => {
    render(<TestView dep={0} />);
    expect(screen.getByTestId("state")).toHaveTextContent("true");
  });

  it("上にスクロールすると false、最下部に戻ると true", () => {
    render(<TestView dep={0} />);
    const vp = screen.getByTestId("vp");

    setScrollMetrics(vp, {
      scrollHeight: 1000,
      clientHeight: 100,
      scrollTop: 0,
    });
    act(() => {
      vp.dispatchEvent(new Event("scroll"));
    });
    expect(screen.getByTestId("state")).toHaveTextContent("false");

    setScrollMetrics(vp, {
      scrollHeight: 1000,
      clientHeight: 100,
      scrollTop: 900,
    });
    act(() => {
      vp.dispatchEvent(new Event("scroll"));
    });
    expect(screen.getByTestId("state")).toHaveTextContent("true");
  });

  it("scrollToBottom は最下部まで（requestAnimationFrame で）スクロールし true に戻す", async () => {
    // rAF を同期実行し、時刻を進めてアニメーションを完了させる
    let ts = 0;
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      ts += 300;
      cb(ts);
      return 1;
    });

    render(<TestView dep={0} />);
    const vp = screen.getByTestId("vp");
    let scrollTopValue = 0;
    Object.defineProperty(vp, "scrollHeight", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(vp, "clientHeight", {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(vp, "scrollTop", {
      get: () => scrollTopValue,
      set: (v: number) => {
        scrollTopValue = v;
      },
      configurable: true,
    });

    act(() => {
      vp.dispatchEvent(new Event("scroll"));
    });
    expect(screen.getByTestId("state")).toHaveTextContent("false");

    await userEvent.click(screen.getByRole("button", { name: "to-bottom" }));

    // 最下部（scrollHeight - clientHeight）へ到達する
    expect(scrollTopValue).toBe(900);
    expect(screen.getByTestId("state")).toHaveTextContent("true");
  });

  it("最下部にいる間は dep 更新でスクロール位置を最下部へ追従する", () => {
    const { rerender } = render(<TestView dep={0} />);
    const vp = screen.getByTestId("vp");
    Object.defineProperty(vp, "scrollHeight", {
      value: 777,
      configurable: true,
    });
    let scrollTopValue = 0;
    Object.defineProperty(vp, "scrollTop", {
      get: () => scrollTopValue,
      set: (v: number) => {
        scrollTopValue = v;
      },
      configurable: true,
    });

    rerender(<TestView dep={1} />);

    expect(scrollTopValue).toBe(777);
  });

  it("ResizeObserver 発火時、最下部にいれば追従する", () => {
    render(<TestView dep={0} />);
    const vp = screen.getByTestId("vp");
    Object.defineProperty(vp, "scrollHeight", {
      value: 500,
      configurable: true,
    });
    let scrollTopValue = 0;
    Object.defineProperty(vp, "scrollTop", {
      get: () => scrollTopValue,
      set: (v: number) => {
        scrollTopValue = v;
      },
      configurable: true,
    });

    act(() => resizeCallback());

    expect(scrollTopValue).toBe(500);
  });
});
