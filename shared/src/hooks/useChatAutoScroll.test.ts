import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChatAutoScroll } from "./useChatAutoScroll";

const buildScrollElement = ({
  scrollHeight,
  scrollTop,
  clientHeight,
}: {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}) => {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    get: () => clientHeight,
  });
  el.scrollTop = scrollTop;
  document.body.appendChild(el);
  return el;
};

describe("useChatAutoScroll", () => {
  it("下端付近（80px 未満）なら DOM 変化時に最下部へスクロールする", async () => {
    const el = buildScrollElement({
      scrollHeight: 500,
      scrollTop: 450,
      clientHeight: 40,
    });

    renderHook(() => useChatAutoScroll({ current: el }));
    el.appendChild(document.createElement("span"));

    await waitFor(() => {
      expect(el.scrollTop).toBe(500);
    });
    el.remove();
  });

  it("下端から 80px 以上離れている（手動スクロール中）なら追従しない", async () => {
    const el = buildScrollElement({
      scrollHeight: 500,
      scrollTop: 100,
      clientHeight: 40,
    });

    renderHook(() => useChatAutoScroll({ current: el }));
    el.appendChild(document.createElement("span"));

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(el.scrollTop).toBe(100);
    el.remove();
  });

  it("ref が null なら何もしない", () => {
    expect(() =>
      renderHook(() => useChatAutoScroll({ current: null })),
    ).not.toThrow();
  });

  it("アンマウント後は DOM 変化に反応しない", async () => {
    const el = buildScrollElement({
      scrollHeight: 500,
      scrollTop: 450,
      clientHeight: 40,
    });

    const { unmount } = renderHook(() => useChatAutoScroll({ current: el }));
    unmount();
    el.appendChild(document.createElement("span"));

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(el.scrollTop).toBe(450);
    el.remove();
  });
});
