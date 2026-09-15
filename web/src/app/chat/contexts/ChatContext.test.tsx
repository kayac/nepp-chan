import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useChatContext } from "./ChatContext";

describe("useChatContext", () => {
  it("Provider の外で使うと例外を投げる", () => {
    // React がエラーを console に出すのでテスト中は抑制
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useChatContext())).toThrow(
      "useChatContext must be used within ChatProvider",
    );
    spy.mockRestore();
  });
});
