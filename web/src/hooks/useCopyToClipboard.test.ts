import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCopyToClipboard } from "./useCopyToClipboard";

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCopyToClipboard", () => {
  it("初期状態は isCopied=false", () => {
    const { result } = renderHook(() => useCopyToClipboard());
    expect(result.current.isCopied).toBe(false);
  });

  it("空文字を渡したら clipboard を呼ばない", () => {
    const { result } = renderHook(() => useCopyToClipboard());

    act(() => result.current.copyToClipboard(""));

    expect(writeText).not.toHaveBeenCalled();
  });

  it("値を渡すと writeText が呼ばれて isCopied=true に", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      result.current.copyToClipboard("hello");
    });

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(result.current.isCopied).toBe(true);
  });

  it("500ms 経過すると isCopied が false に戻る", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      result.current.copyToClipboard("x");
    });

    expect(result.current.isCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isCopied).toBe(false);
  });
});
