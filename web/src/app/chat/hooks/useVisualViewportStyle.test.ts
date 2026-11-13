import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useVisualViewportStyle } from "./useVisualViewportStyle";

const originalVisualViewport = window.visualViewport;

const stubVisualViewport = (viewport: {
  height: number;
  offsetTop: number;
  scale: number;
}) => {
  const target = Object.assign(new EventTarget(), viewport);
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: target,
  });
  return target;
};

afterEach(() => {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: originalVisualViewport,
  });
});

describe("useVisualViewportStyle", () => {
  it("見えている領域の高さと上端の位置を返す", () => {
    stubVisualViewport({ height: 400, offsetTop: 120, scale: 1 });

    const { result } = renderHook(() => useVisualViewportStyle());

    expect(result.current).toEqual({ height: 400, top: 120 });
  });

  it("キーボードの開閉で resize が来たら追従する", () => {
    const viewport = stubVisualViewport({
      height: 800,
      offsetTop: 0,
      scale: 1,
    });
    const { result } = renderHook(() => useVisualViewportStyle());

    act(() => {
      Object.assign(viewport, { height: 450 });
      viewport.dispatchEvent(new Event("resize"));
    });

    expect(result.current).toEqual({ height: 450, top: 0 });
  });

  it("Safari が入力欄を見せるためにずらした scroll にも追従する", () => {
    const viewport = stubVisualViewport({
      height: 450,
      offsetTop: 0,
      scale: 1,
    });
    const { result } = renderHook(() => useVisualViewportStyle());

    act(() => {
      Object.assign(viewport, { offsetTop: 300 });
      viewport.dispatchEvent(new Event("scroll"));
    });

    expect(result.current).toEqual({ height: 450, top: 300 });
  });

  it("ピンチで拡大している間は高さを指定しない", () => {
    stubVisualViewport({ height: 300, offsetTop: 50, scale: 2 });

    const { result } = renderHook(() => useVisualViewportStyle());

    expect(result.current).toBeUndefined();
  });

  it("visualViewport が無いブラウザでは高さを指定しない", () => {
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: null,
    });

    const { result } = renderHook(() => useVisualViewportStyle());

    expect(result.current).toBeUndefined();
  });
});
