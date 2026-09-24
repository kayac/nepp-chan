import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "~/lib/logger";
import { CallBridge } from "./call-bridge";

const { createVoiceConversationMock } = vi.hoisted(() => ({
  createVoiceConversationMock: vi.fn(),
}));

vi.mock("./conversation", () => ({
  createVoiceConversation: createVoiceConversationMock,
}));

describe("CallBridge", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("TTS には読みに置き換えた文を送り、履歴には元の文を保存する", async () => {
    const runTurn = vi.fn(async function* () {
      yield "音威";
      yield "子府は9:";
      yield "00からだよ";
    });
    const persistTurn = vi.fn();
    createVoiceConversationMock.mockResolvedValue({ runTurn, persistTurn });
    const bridge = new CallBridge(
      {} as DurableObjectState,
      {} as CloudflareBindings,
    );
    const ws = { send: vi.fn() } as unknown as WebSocket;
    const handlePrompt = Reflect.get(bridge, "handlePrompt") as (
      ws: WebSocket,
      text: string,
    ) => Promise<void>;

    await handlePrompt.call(bridge, ws, "役場は何時から");

    const spoken = vi
      .mocked(ws.send)
      .mock.calls.map(([raw]) => JSON.parse(raw as string))
      .filter((message) => message.type === "text")
      .map((message) => message.token)
      .join("");
    expect(spoken).toContain("おといねっぷは9時からだよ");
    expect(persistTurn).toHaveBeenCalledWith(
      expect.objectContaining({ assistantText: "音威子府は9:00からだよ" }),
    );
  });

  it("先回りのトグルをターンに引き渡す", async () => {
    const runTurn = vi.fn(async function* () {
      yield "回答";
    });
    createVoiceConversationMock.mockResolvedValue({
      runTurn,
      persistTurn: vi.fn(),
    });

    const bridge = new CallBridge(
      {} as DurableObjectState,
      {} as CloudflareBindings,
    );
    const ws = { send: vi.fn() } as unknown as WebSocket;
    const handlePrompt = Reflect.get(bridge, "handlePrompt") as (
      ws: WebSocket,
      text: string,
    ) => Promise<void>;

    await handlePrompt.call(bridge, ws, "質問");

    expect(runTurn).toHaveBeenLastCalledWith(
      expect.objectContaining({
        parentRouting: true,
        prefetchEnabled: true,
      }),
    );

    Reflect.set(bridge, "config", {
      ...(Reflect.get(bridge, "config") as Record<string, unknown>),
      parentRoutingEnabled: false,
      prefetchEnabled: false,
    });
    await handlePrompt.call(bridge, ws, "次の質問");

    expect(runTurn).toHaveBeenLastCalledWith(
      expect.objectContaining({
        parentRouting: false,
        prefetchEnabled: false,
      }),
    );
  });

  it("完了トークン送信後は D1 保存中でも active turn を解除する", async () => {
    let resolvePersistence: (() => void) | undefined;
    const runTurn = vi.fn(async function* () {
      yield "回答";
    });
    const persistTurn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePersistence = resolve;
        }),
    );
    createVoiceConversationMock.mockResolvedValue({ runTurn, persistTurn });

    const bridge = new CallBridge(
      {} as DurableObjectState,
      {} as CloudflareBindings,
    );
    Reflect.set(bridge, "from", "client:tester");
    Reflect.set(bridge, "callSid", "CA123");
    const handlePrompt = Reflect.get(bridge, "handlePrompt") as (
      ws: WebSocket,
      text: string,
    ) => Promise<void>;

    const prompt = handlePrompt.call(
      bridge,
      { send: vi.fn() } as unknown as WebSocket,
      "質問",
    );
    await vi.waitFor(() => expect(persistTurn).toHaveBeenCalledOnce());

    expect(Reflect.get(bridge, "currentTurn")).toBeNull();

    resolvePersistence?.();
    await prompt;
  });

  it("assistantText が空のターンは D1 へ保存しない", async () => {
    const runTurn = vi.fn(async function* () {
      // ツール呼び出しのみで終わり、text-delta を1つも yield しないケース
    });
    const persistTurn = vi.fn();
    createVoiceConversationMock.mockResolvedValue({ runTurn, persistTurn });

    const bridge = new CallBridge(
      {} as DurableObjectState,
      {} as CloudflareBindings,
    );
    Reflect.set(bridge, "from", "client:tester");
    Reflect.set(bridge, "callSid", "CA123");
    const handlePrompt = Reflect.get(bridge, "handlePrompt") as (
      ws: WebSocket,
      text: string,
    ) => Promise<void>;

    await handlePrompt.call(
      bridge,
      { send: vi.fn() } as unknown as WebSocket,
      "質問",
    );

    expect(persistTurn).not.toHaveBeenCalled();
  });

  it("turnEndMs は D1 保存待ち時間を含まず、persistenceMs に分離して計測する", async () => {
    vi.useFakeTimers();
    const runTurn = vi.fn(async function* () {
      yield "回答";
    });
    const persistTurn = vi.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 500)),
    );
    createVoiceConversationMock.mockResolvedValue({ runTurn, persistTurn });
    const infoSpy = vi.spyOn(logger, "info");

    const bridge = new CallBridge(
      {} as DurableObjectState,
      {} as CloudflareBindings,
    );
    Reflect.set(bridge, "from", "client:tester");
    Reflect.set(bridge, "callSid", "CA123");
    const handlePrompt = Reflect.get(bridge, "handlePrompt") as (
      ws: WebSocket,
      text: string,
    ) => Promise<void>;

    const prompt = handlePrompt.call(
      bridge,
      { send: vi.fn() } as unknown as WebSocket,
      "質問",
    );
    await vi.advanceTimersByTimeAsync(500);
    await prompt;

    const timingCall = infoSpy.mock.calls.find(
      ([message]) => message === "[Voice] turn timing",
    );
    const timing = timingCall?.[1] as Record<string, number>;
    expect(timing.turnEndMs).toBeLessThan(500);
    expect(timing.persistenceMs).toBeGreaterThanOrEqual(500);
  });

  describe("割り込み", () => {
    const setupBridge = (conversation: Record<string, unknown>) => {
      createVoiceConversationMock.mockResolvedValue(conversation);
      const bridge = new CallBridge(
        {} as DurableObjectState,
        {} as CloudflareBindings,
      );
      Reflect.set(bridge, "verified", true);
      const ws = { send: vi.fn() } as unknown as WebSocket;
      const handlePrompt = (
        Reflect.get(bridge, "handlePrompt") as (
          ws: WebSocket,
          text: string,
        ) => Promise<void>
      ).bind(bridge, ws);
      const onMessage = Reflect.get(bridge, "onMessage") as (
        ws: WebSocket,
        event: MessageEvent,
      ) => Promise<void>;
      const interrupt = (utteranceUntilInterrupt?: string) =>
        onMessage.call(bridge, ws, {
          data: JSON.stringify({ type: "interrupt", utteranceUntilInterrupt }),
        } as MessageEvent);
      return { handlePrompt, interrupt };
    };

    const hangingTurn = () => {
      let started: () => void = () => {};
      const startedPromise = new Promise<void>((resolve) => {
        started = resolve;
      });
      const runTurn = vi.fn(async function* ({
        signal,
      }: {
        signal: AbortSignal;
      }) {
        yield "駅は北口";
        started();
        await new Promise((resolve) =>
          signal.addEventListener("abort", resolve, { once: true }),
        );
      });
      return { runTurn, startedPromise };
    };

    it("応答中に遮られたら聞かせた分を履歴に残し D1 にも保存する", async () => {
      const { runTurn, startedPromise } = hangingTurn();
      const recordInterruptedTurn = vi.fn();
      const persistTurn = vi.fn();
      const { handlePrompt, interrupt } = setupBridge({
        runTurn,
        recordInterruptedTurn,
        truncateLastReply: vi.fn(),
        persistTurn,
      });

      const prompt = handlePrompt("駅はどこ");
      await startedPromise;
      await interrupt("駅は");
      await prompt;

      expect(recordInterruptedTurn).toHaveBeenCalledWith({
        userText: "駅はどこ",
        heardText: "駅は",
      });
      expect(persistTurn).toHaveBeenCalledWith({
        turnIndex: 0,
        userText: "駅はどこ",
        assistantText: "駅は",
      });
    });

    it("何も聞かせないうちに遮られたら履歴には残すが D1 には保存しない", async () => {
      const { runTurn, startedPromise } = hangingTurn();
      const recordInterruptedTurn = vi.fn();
      const persistTurn = vi.fn();
      const { handlePrompt, interrupt } = setupBridge({
        runTurn,
        recordInterruptedTurn,
        truncateLastReply: vi.fn(),
        persistTurn,
      });

      const prompt = handlePrompt("駅はどこ");
      await startedPromise;
      await interrupt("");
      await prompt;

      expect(recordInterruptedTurn).toHaveBeenCalledWith({
        userText: "駅はどこ",
        heardText: "",
      });
      expect(persistTurn).not.toHaveBeenCalled();
    });

    it("応答中に次の発話が確定したら、次のターンを始める前に前の発話を履歴に残す", async () => {
      const { runTurn, startedPromise } = hangingTurn();
      const order: string[] = [];
      const recordInterruptedTurn = vi.fn(({ userText }) => {
        order.push(`record:${userText}`);
      });
      const nextRunTurn = vi.fn(async function* ({ text }: { text: string }) {
        order.push(`run:${text}`);
        yield "回答";
      });
      const { handlePrompt } = setupBridge({
        runTurn: vi.fn((params) =>
          params.text === "駅の" ? runTurn(params) : nextRunTurn(params),
        ),
        recordInterruptedTurn,
        truncateLastReply: vi.fn(),
        persistTurn: vi.fn(),
      });

      const first = handlePrompt("駅の");
      await startedPromise;
      await handlePrompt("時刻表が知りたい");
      await first;

      expect(order).toEqual(["record:駅の", "run:時刻表が知りたい"]);
    });

    it("遮られた直後に次の発話が確定しても、遮られたターンは一度だけ履歴に残す", async () => {
      const { runTurn, startedPromise } = hangingTurn();
      const recordInterruptedTurn = vi.fn();
      const { handlePrompt, interrupt } = setupBridge({
        runTurn: vi.fn((params) =>
          params.text === "駅は" ? runTurn(params) : (async function* () {})(),
        ),
        recordInterruptedTurn,
        truncateLastReply: vi.fn(),
        persistTurn: vi.fn(),
      });

      const first = handlePrompt("駅は");
      await startedPromise;
      const interrupted = interrupt("駅は北");
      const second = handlePrompt("北口のこと");
      await Promise.all([interrupted, second, first]);

      expect(recordInterruptedTurn).toHaveBeenCalledTimes(1);
      expect(recordInterruptedTurn).toHaveBeenCalledWith({
        userText: "駅は",
        heardText: "駅は北",
      });
    });

    it("応答を送り終えた後の読み上げ中に遮られたら直前の返事を聞かせた分に切り詰める", async () => {
      const truncateLastReply = vi.fn();
      const { handlePrompt, interrupt } = setupBridge({
        runTurn: vi.fn(async function* () {
          yield "駅は北口だよ。バスもあるよ。";
        }),
        recordInterruptedTurn: vi.fn(),
        truncateLastReply,
        persistTurn: vi.fn(),
      });

      await handlePrompt("駅はどこ");
      await interrupt("駅は北口だよ。");

      expect(truncateLastReply).toHaveBeenCalledWith("駅は北口だよ。");
    });

    it("聞かせた分が通知されない割り込みでは直前の返事を変えない", async () => {
      const truncateLastReply = vi.fn();
      const { handlePrompt, interrupt } = setupBridge({
        runTurn: vi.fn(async function* () {
          yield "駅は北口だよ。";
        }),
        recordInterruptedTurn: vi.fn(),
        truncateLastReply,
        persistTurn: vi.fn(),
      });

      await handlePrompt("駅はどこ");
      await interrupt();

      expect(truncateLastReply).not.toHaveBeenCalled();
    });
  });

  describe("相槌", () => {
    const setupAizuchi = () => {
      vi.useFakeTimers();
      const bridge = new CallBridge(
        {} as DurableObjectState,
        {} as CloudflareBindings,
      );
      Reflect.set(bridge, "verified", true);
      Reflect.set(bridge, "handlePrompt", vi.fn());
      const ws = { send: vi.fn() } as unknown as WebSocket;
      const onMessage = Reflect.get(bridge, "onMessage") as (
        ws: WebSocket,
        event: MessageEvent,
      ) => Promise<void>;
      const prompt = (voicePrompt: string, last: boolean) =>
        onMessage.call(bridge, ws, {
          data: JSON.stringify({ type: "prompt", voicePrompt, last }),
        } as MessageEvent);
      const aizuchiCount = () =>
        vi
          .mocked(ws.send)
          .mock.calls.filter(([raw]) =>
            ["うん", "うんうん"].includes(JSON.parse(raw as string).token),
          ).length;
      return { prompt, aizuchiCount };
    };

    it("話している最中は打たず、中間認識が途切れて間ができたら打つ", async () => {
      const { prompt, aizuchiCount } = setupAizuchi();

      await prompt("音威子府の駅の近くで", false);
      await vi.advanceTimersByTimeAsync(300);
      await prompt("音威子府の駅の近くでご飯を", false);
      await vi.advanceTimersByTimeAsync(300);
      expect(aizuchiCount()).toBe(0);

      await vi.advanceTimersByTimeAsync(200);
      expect(aizuchiCount()).toBe(1);
    });

    it("間ができる前に発話が確定したら打たない", async () => {
      const { prompt, aizuchiCount } = setupAizuchi();

      await prompt("音威子府の駅の近くで", false);
      await vi.advanceTimersByTimeAsync(300);
      await prompt("音威子府の駅の近くで", true);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(aizuchiCount()).toBe(0);
    });
  });
});
