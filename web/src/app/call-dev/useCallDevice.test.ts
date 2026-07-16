import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCallDevice } from "./useCallDevice";

const {
  connect,
  destroy,
  disconnectAll,
  deviceOn,
  callOn,
  audioOutgoing,
  fetchCallToken,
} = vi.hoisted(() => ({
  connect: vi.fn(),
  destroy: vi.fn(),
  disconnectAll: vi.fn(),
  deviceOn: vi.fn(),
  callOn: vi.fn(),
  audioOutgoing: vi.fn(),
  fetchCallToken: vi.fn(),
}));

vi.mock("./api", () => ({ fetchCallToken }));
vi.mock("@twilio/voice-sdk", () => ({
  Device: class {
    connect = connect;
    destroy = destroy;
    disconnectAll = disconnectAll;
    on = deviceOn;
    audio = { outgoing: audioOutgoing };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  connect.mockResolvedValue({ on: callOn });
});

describe("useCallDevice", () => {
  it("接続中に切断したらトークン取得後も発信しない", async () => {
    let resolveToken!: (value: { token: string; identity: string }) => void;
    fetchCallToken.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveToken = resolve;
        }),
    );
    const { result } = renderHook(() => useCallDevice());

    let startPromise!: Promise<void>;
    act(() => {
      startPromise = result.current.startCall();
    });
    act(() => result.current.endCall());
    await act(async () => {
      resolveToken({ token: "token", identity: "dev-1" });
      await startPromise;
    });

    expect(connect).not.toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("発信音を無効化してから発信する", async () => {
    fetchCallToken.mockResolvedValue({ token: "token", identity: "dev-1" });
    const { result } = renderHook(() => useCallDevice());

    await act(() => result.current.startCall());

    expect(audioOutgoing).toHaveBeenCalledWith(false);
    expect(audioOutgoing.mock.invocationCallOrder[0]).toBeLessThan(
      connect.mock.invocationCallOrder[0],
    );
  });

  it("アンマウント時に Device を破棄する", async () => {
    fetchCallToken.mockResolvedValue({ token: "token", identity: "dev-1" });
    const { result, unmount } = renderHook(() => useCallDevice());

    await act(() => result.current.startCall());
    unmount();

    expect(destroy).toHaveBeenCalled();
  });
});
