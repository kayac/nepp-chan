import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TurnRoute } from "~/lib/classify-intent";
import { BRIDGE_CONFIG_DEFAULTS, type BridgeConfig } from "./bridge-config";
import { createSilenceCover } from "./silence-cover";

const setup = (
  overrides: Partial<BridgeConfig> = {},
  route: TurnRoute = "village",
) => {
  const sendText = vi.fn();
  const sendPlay = vi.fn();
  const controller = new AbortController();
  let fillerIndex = 0;
  const created = createSilenceCover({
    config: { ...BRIDGE_CONFIG_DEFAULTS, ...overrides },
    signal: controller.signal,
    nextFillerIndex: () => fillerIndex++,
    sendText,
    sendPlay,
  });
  const cover = {
    ...created,
    start: () => created.start(Promise.resolve(route)),
  };
  return { cover, created, sendText, sendPlay, controller };
};

describe("createSilenceCover", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("フィラー", () => {
    it("行き先が決まる前に返事が始まっていたら、フィラーを送らない", async () => {
      const { created, sendText } = setup({ fillerDelayMs: 0 });
      created.onToken();
      created.start(Promise.resolve("village"));
      await vi.advanceTimersByTimeAsync(0);
      expect(sendText).not.toHaveBeenCalled();
    });

    it("行き先が決まる前にツールが呼ばれていたら、フィラーを送らない", async () => {
      const { created, sendText } = setup({ fillerDelayMs: 0 });
      created.onToolCall();
      sendText.mockClear();
      created.start(Promise.resolve("village"));
      await vi.advanceTimersByTimeAsync(0);
      expect(sendText).not.toHaveBeenCalled();
    });

    it("調べないターンでは既定でフィラーを送らない", async () => {
      const { cover, sendText } = setup({ fillerDelayMs: 0 }, "none");
      cover.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(sendText).not.toHaveBeenCalled();
    });

    it("遅延 0 なら start で即時にフィラーを送る（調べ物のあるターンには考え中プール）", async () => {
      const { cover, sendText } = setup({ fillerDelayMs: 0 });
      cover.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(sendText).toHaveBeenCalledWith("えーっとね", true, {
        preemptible: true,
        interruptible: true,
      });
    });

    it("fillerEnabled が false なら何も送らない", async () => {
      const { cover, sendText } = setup({ fillerEnabled: false });
      cover.start();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(sendText).not.toHaveBeenCalled();
    });

    it("遅延ありでは経過後に送る", async () => {
      const { cover, sendText } = setup({ fillerDelayMs: 800 });
      cover.start();
      await vi.advanceTimersByTimeAsync(799);
      expect(sendText).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(sendText).toHaveBeenCalledTimes(1);
    });

    it("遅延中に応答トークンが来たら省略する", async () => {
      const { cover, sendText } = setup({ fillerDelayMs: 800 });
      cover.start();
      cover.onToken();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(sendText).not.toHaveBeenCalled();
    });

    it("遅延中に barge-in（abort）されたら送らない", async () => {
      const { cover, sendText, controller } = setup({ fillerDelayMs: 800 });
      cover.start();
      controller.abort();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(sendText).not.toHaveBeenCalled();
    });

    it("カスタム文言プールを使う", async () => {
      const { cover, sendText } = setup(
        { fillerDelayMs: 0, thinkingFillers: ["どれどれ"] },
        "village",
      );
      cover.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(sendText).toHaveBeenCalledWith("どれどれ", true, {
        preemptible: true,
        interruptible: true,
      });
    });
    it("行き先が決まる前から遅延を数え、経過時点で決まった行き先のフィラーを送る", async () => {
      const { created, sendText } = setup({ fillerDelayMs: 800 });
      let resolveRoute: (route: TurnRoute) => void = () => {};
      created.start(
        new Promise<TurnRoute>((resolve) => {
          resolveRoute = resolve;
        }),
      );
      await vi.advanceTimersByTimeAsync(300);
      resolveRoute("village");
      await vi.advanceTimersByTimeAsync(500);
      expect(sendText).toHaveBeenCalledWith("えーっとね", true, {
        preemptible: true,
        interruptible: true,
      });
    });

    it("遅延が過ぎても行き先が決まっていなければ、決まった時点で送る", async () => {
      const { created, sendText } = setup({ fillerDelayMs: 800 });
      let resolveRoute: (route: TurnRoute) => void = () => {};
      created.start(
        new Promise<TurnRoute>((resolve) => {
          resolveRoute = resolve;
        }),
      );
      await vi.advanceTimersByTimeAsync(1_000);
      expect(sendText).not.toHaveBeenCalled();
      resolveRoute("village");
      await vi.advanceTimersByTimeAsync(0);
      expect(sendText).toHaveBeenCalledTimes(1);
    });

    it("行き先を待つ間に応答トークンが来たら送らない", async () => {
      const { created, sendText } = setup({ fillerDelayMs: 800 });
      let resolveRoute: (route: TurnRoute) => void = () => {};
      created.start(
        new Promise<TurnRoute>((resolve) => {
          resolveRoute = resolve;
        }),
      );
      await vi.advanceTimersByTimeAsync(1_000);
      created.onToken();
      resolveRoute("village");
      await vi.advanceTimersByTimeAsync(0);
      expect(sendText).not.toHaveBeenCalled();
    });
  });

  describe("保留音", () => {
    it("遅延 0 でも待機を伝え終わってから流す", () => {
      const { cover, sendText, sendPlay } = setup({
        holdAudioEnabled: true,
        fillerEnabled: false,
        holdDelayMs: 0,
      });
      cover.onToolCall();
      expect(sendText).toHaveBeenCalledWith("ちょっと待ってね", true, {
        preemptible: false,
        interruptible: true,
      });
      expect(sendPlay).not.toHaveBeenCalled();
      vi.advanceTimersByTime(2_999);
      expect(sendPlay).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(sendPlay).toHaveBeenCalledWith(
        BRIDGE_CONFIG_DEFAULTS.holdAudioUrl,
        { loop: 0, preemptible: true, interruptible: true },
      );
    });

    it("holdAudioEnabled が false なら待機を伝え、保留音は流さない", () => {
      const { cover, sendText, sendPlay } = setup({
        holdAudioEnabled: false,
      });
      cover.onToolCall();
      vi.advanceTimersByTime(10_000);
      expect(sendText).toHaveBeenCalledWith("ちょっと待ってね", true, {
        preemptible: false,
        interruptible: true,
      });
      expect(sendPlay).not.toHaveBeenCalled();
    });

    it("遅延中に応答トークンが来たら流さない", () => {
      const { cover, sendPlay } = setup({
        holdAudioEnabled: true,
        holdDelayMs: 1_000,
      });
      cover.onToolCall();
      cover.onToken();
      vi.advanceTimersByTime(10_000);
      expect(sendPlay).not.toHaveBeenCalled();
    });

    it("再生中の二重 onToolCall では重ねて流さない", () => {
      const { cover, sendText, sendPlay } = setup({
        holdAudioEnabled: true,
        holdDelayMs: 0,
      });
      cover.onToolCall();
      cover.onToolCall();
      vi.advanceTimersByTime(3_000);
      expect(sendText).toHaveBeenCalledTimes(1);
      expect(sendPlay).toHaveBeenCalledTimes(1);
    });

    it("トークン再開後の再検索では改めて流せる", () => {
      const { cover, sendPlay } = setup({
        holdAudioEnabled: true,
        holdDelayMs: 0,
        fillerEnabled: false,
      });
      cover.onToolCall();
      vi.advanceTimersByTime(3_000);
      cover.onToken();
      cover.onToolCall();
      vi.advanceTimersByTime(3_000);
      expect(sendPlay).toHaveBeenCalledTimes(2);
    });

    it("保留音が始まったら予約中のフィラーを取り消す", () => {
      const { cover, sendText } = setup({
        holdAudioEnabled: true,
        fillerDelayMs: 2_000,
        holdDelayMs: 0,
      });
      cover.start();
      cover.onToolCall();
      vi.advanceTimersByTime(10_000);
      expect(sendText).toHaveBeenCalledTimes(1);
      expect(sendText).toHaveBeenCalledWith("ちょっと待ってね", true, {
        preemptible: false,
        interruptible: true,
      });
    });
  });

  describe("待ちの声かけ", () => {
    const holdPhrases = ["いま調べてるよ", "もうちょっと待ってね"];

    it("待機を伝えたあと、間隔ごとに声かけを順に繰り返す", () => {
      const { cover, sendText, sendPlay } = setup({
        fillerEnabled: false,
        holdPhrases,
        holdPhraseIntervalMs: 6_000,
      });
      cover.onToolCall();
      vi.advanceTimersByTime(5_999);
      expect(sendText).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      vi.advanceTimersByTime(6_000);
      vi.advanceTimersByTime(6_000);
      expect(sendText.mock.calls.map(([text]) => text)).toEqual([
        "ちょっと待ってね",
        "いま調べてるよ",
        "もうちょっと待ってね",
        "いま調べてるよ",
      ]);
      expect(sendPlay).not.toHaveBeenCalled();
    });

    it("応答トークンが届いたら声かけをやめる", () => {
      const { cover, sendText } = setup({
        fillerEnabled: false,
        holdPhrases,
        holdPhraseIntervalMs: 6_000,
      });
      cover.onToolCall();
      vi.advanceTimersByTime(6_000);
      cover.onToken();
      vi.advanceTimersByTime(30_000);
      expect(sendText).toHaveBeenCalledTimes(2);
    });

    it("検索が重なっても声かけを二重に始めない", () => {
      const { cover, sendText } = setup({
        fillerEnabled: false,
        holdPhrases,
        holdPhraseIntervalMs: 6_000,
      });
      cover.onToolCall();
      cover.onToolCall();
      vi.advanceTimersByTime(6_000);
      expect(sendText).toHaveBeenCalledTimes(2);
    });

    it("保留音を使う設定では声かけをしない", () => {
      const { cover, sendText } = setup({
        fillerEnabled: false,
        holdAudioEnabled: true,
        holdPhrases,
      });
      cover.onToolCall();
      vi.advanceTimersByTime(30_000);
      expect(sendText).toHaveBeenCalledTimes(1);
    });
  });

  it("dispose は予約中のフィラー・保留音をすべて取り消す", () => {
    const { cover, sendText, sendPlay } = setup({
      fillerDelayMs: 1_000,
      holdDelayMs: 1_000,
    });
    cover.start();
    cover.onToolCall();
    cover.dispose();
    vi.advanceTimersByTime(10_000);
    expect(sendText).toHaveBeenCalledTimes(1);
    expect(sendText).toHaveBeenCalledWith("ちょっと待ってね", true, {
      preemptible: false,
      interruptible: true,
    });
    expect(sendPlay).not.toHaveBeenCalled();
  });
});
