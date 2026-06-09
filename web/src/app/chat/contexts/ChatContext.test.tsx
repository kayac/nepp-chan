import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  ChatContext,
  type ChatContextValue,
  useChatContext,
} from "./ChatContext";

const buildValue = (): ChatContextValue => ({
  threadId: "thread-1",
  messages: [],
  status: "ready",
  error: undefined,
  isRunning: false,
  sendMessage: vi.fn(),
  stop: vi.fn(),
});

describe("useChatContext", () => {
  it("Provider の外で使うと例外を投げる", () => {
    // React がエラーを console に出すのでテスト中は抑制
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useChatContext())).toThrow(
      "useChatContext must be used within ChatProvider",
    );
    spy.mockRestore();
  });

  it("Provider 内では context の値をそのまま返す", () => {
    const value = buildValue();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
    );

    const { result } = renderHook(() => useChatContext(), { wrapper });

    expect(result.current).toBe(value);
  });
});
