import { describe, expect, it, vi } from "vitest";
import { CallBridge } from "./call-bridge";

const { createVoiceTurnRunnerMock } = vi.hoisted(() => ({
  createVoiceTurnRunnerMock: vi.fn(),
}));

vi.mock("./conversation", () => ({
  createVoiceTurnRunner: createVoiceTurnRunnerMock,
}));

describe("CallBridge", () => {
  it("ランナー初期化中に中断されたターンは発話も実行もしない", async () => {
    let resolveRunner: ((runner: ReturnType<typeof vi.fn>) => void) | undefined;
    const turnRunner = vi.fn(async function* () {
      yield "回答";
    });
    createVoiceTurnRunnerMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRunner = resolve;
      }),
    );

    const bridge = new CallBridge(
      {} as DurableObjectState,
      {} as CloudflareBindings,
    );
    const ws = { send: vi.fn() } as unknown as WebSocket;
    const handlePrompt = Reflect.get(bridge, "handlePrompt") as (
      ws: WebSocket,
      text: string,
    ) => Promise<void>;
    const onMessage = Reflect.get(bridge, "onMessage") as (
      ws: WebSocket,
      event: MessageEvent,
    ) => Promise<void>;

    const prompt = handlePrompt.call(bridge, ws, "質問");
    await onMessage.call(bridge, ws, {
      data: JSON.stringify({ type: "interrupt" }),
    } as MessageEvent);
    resolveRunner?.(turnRunner);
    await prompt;

    expect(turnRunner).not.toHaveBeenCalled();
    expect(ws.send).not.toHaveBeenCalled();
  });
});
