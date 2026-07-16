import { describe, expect, it, vi } from "vitest";
import { CallBridge } from "./call-bridge";

const { createVoiceConversationMock } = vi.hoisted(() => ({
  createVoiceConversationMock: vi.fn(),
}));

vi.mock("./conversation", () => ({
  createVoiceConversation: createVoiceConversationMock,
}));

describe("CallBridge", () => {
  it("WebSocket のメッセージ処理を waitUntil に登録する", async () => {
    const waitUntil = vi.fn();
    const bridge = new CallBridge(
      { waitUntil } as unknown as DurableObjectState,
      {} as CloudflareBindings,
    );
    const handleMessageEvent = Reflect.get(bridge, "handleMessageEvent") as (
      ws: WebSocket,
      event: MessageEvent,
    ) => void;

    handleMessageEvent.call(
      bridge,
      {} as WebSocket,
      {
        data: new ArrayBuffer(0),
      } as MessageEvent,
    );

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
  });

  it("ランナー初期化中に中断されたターンは発話も実行もしない", async () => {
    const turnRunner = vi.fn(async function* () {
      yield "回答";
    });
    let resolveRunner:
      | ((conversation: {
          runTurn: typeof turnRunner;
          persistTurn: () => Promise<void>;
        }) => void)
      | undefined;
    createVoiceConversationMock.mockReturnValue(
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
    resolveRunner?.({ runTurn: turnRunner, persistTurn: vi.fn() });
    await prompt;

    expect(turnRunner).not.toHaveBeenCalled();
    expect(ws.send).not.toHaveBeenCalled();
  });

  it("完了トークンを送ってから D1 保存を待つ", async () => {
    const order: string[] = [];
    const runTurn = vi.fn(async function* () {
      yield "回答";
    });
    const persistTurn = vi.fn(async () => {
      order.push("persist");
    });
    createVoiceConversationMock.mockResolvedValue({ runTurn, persistTurn });

    const bridge = new CallBridge(
      {} as DurableObjectState,
      {} as CloudflareBindings,
    );
    Reflect.set(bridge, "from", "client:tester");
    Reflect.set(bridge, "callSid", "CA123");
    const ws = {
      send: vi.fn((raw: string) => {
        const message = JSON.parse(raw) as {
          type: string;
          token?: string;
          last?: boolean;
        };
        if (message.type === "text" && message.last && message.token === "") {
          order.push("last");
        }
      }),
    } as unknown as WebSocket;
    const handlePrompt = Reflect.get(bridge, "handlePrompt") as (
      ws: WebSocket,
      text: string,
    ) => Promise<void>;

    await handlePrompt.call(bridge, ws, "質問");

    expect(order).toEqual(["last", "persist"]);
    expect(createVoiceConversationMock).toHaveBeenCalledWith({
      env: expect.anything(),
      from: "client:tester",
      callSid: "CA123",
    });
    expect(persistTurn).toHaveBeenCalledWith({
      turnIndex: 0,
      userText: "質問",
      assistantText: "回答",
    });
  });
});
