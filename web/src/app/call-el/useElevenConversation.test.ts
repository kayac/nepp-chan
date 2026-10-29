import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useElevenConversation } from "./useElevenConversation";

const { startSession, endSession, fetchSignedUrl, useConversation } =
  vi.hoisted(() => ({
    startSession: vi.fn(),
    endSession: vi.fn(),
    fetchSignedUrl: vi.fn(),
    useConversation: vi.fn(),
  }));

vi.mock("./api", () => ({ fetchSignedUrl }));
vi.mock("@elevenlabs/react", () => ({ useConversation }));

type Callbacks = Parameters<typeof useConversation>[0];
const callbacks = () => useConversation.mock.calls.at(-1)?.[0] as Callbacks;

beforeEach(() => {
  vi.clearAllMocks();
  fetchSignedUrl.mockResolvedValue("wss://el/x");
  useConversation.mockReturnValue({
    startSession,
    endSession,
    status: "disconnected",
    mode: "listening",
  });
});

describe("useElevenConversation", () => {
  it("signed URL を取ってから websocket で startSession する", async () => {
    const { result } = renderHook(() => useElevenConversation());
    await act(() => result.current.start());
    expect(startSession).toHaveBeenCalledWith({
      signedUrl: "wss://el/x",
      connectionType: "websocket",
    });
  });

  it("signed URL の取得に失敗したら error を出して startSession しない", async () => {
    fetchSignedUrl.mockRejectedValue(new Error("管理者ログインが必要です"));
    const { result } = renderHook(() => useElevenConversation());
    await act(() => result.current.start());
    expect(result.current.error).toBe("管理者ログインが必要です");
    expect(startSession).not.toHaveBeenCalled();
  });

  it("onMessage の発話を role 付きで積み、start で消す", async () => {
    const { result } = renderHook(() => useElevenConversation());
    act(() => {
      callbacks().onMessage({ role: "user", message: "こんにちは" });
      callbacks().onMessage({ role: "agent", message: "やあ" });
    });
    expect(result.current.lines).toEqual([
      { id: 0, role: "user", text: "こんにちは" },
      { id: 1, role: "agent", text: "やあ" },
    ]);
    await act(() => result.current.start());
    expect(result.current.lines).toEqual([]);
  });

  it("onError のメッセージを error として持ち、start で消す", async () => {
    const { result } = renderHook(() => useElevenConversation());
    act(() => callbacks().onError("boom"));
    expect(result.current.error).toBe("boom");
    await act(() => result.current.start());
    expect(result.current.error).toBeNull();
  });

  it("stop は endSession をそのまま呼ぶ", () => {
    const { result } = renderHook(() => useElevenConversation());
    result.current.stop();
    expect(endSession).toHaveBeenCalled();
  });
});
