import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BRIDGE_CONFIG_DEFAULTS, type BridgeConfig } from "./bridge-config";
import { createSilenceCover } from "./silence-cover";

const setup = (
  overrides: Partial<BridgeConfig> = {},
  promptText = "駅はどこ",
) => {
  const sendText = vi.fn();
  const sendPlay = vi.fn();
  const controller = new AbortController();
  let fillerIndex = 0;
  const cover = createSilenceCover({
    config: { ...BRIDGE_CONFIG_DEFAULTS, ...overrides },
    promptText,
    signal: controller.signal,
    nextFillerIndex: () => fillerIndex++,
    sendText,
    sendPlay,
  });
  return { cover, sendText, sendPlay, controller };
};

describe("createSilenceCover", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("フィラー", () => {
    it("遅延 0 なら start で即時にフィラーを送る（質問には考え中プール）", () => {
      const { cover, sendText } = setup({ fillerDelayMs: 0 });
      cover.start();
      expect(sendText).toHaveBeenCalledWith("えーっとね", true, {
        preemptible: true,
        interruptible: true,
      });
    });

    it("fillerEnabled が false なら何も送らない", () => {
      const { cover, sendText } = setup({ fillerEnabled: false });
      cover.start();
      vi.advanceTimersByTime(10_000);
      expect(sendText).not.toHaveBeenCalled();
    });

    it("遅延ありでは経過後に送る", () => {
      const { cover, sendText } = setup({ fillerDelayMs: 800 });
      cover.start();
      vi.advanceTimersByTime(799);
      expect(sendText).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(sendText).toHaveBeenCalledTimes(1);
    });

    it("遅延中に応答トークンが来たら省略する", () => {
      const { cover, sendText } = setup({ fillerDelayMs: 800 });
      cover.start();
      cover.onToken();
      vi.advanceTimersByTime(10_000);
      expect(sendText).not.toHaveBeenCalled();
    });

    it("遅延中に barge-in（abort）されたら送らない", () => {
      const { cover, sendText, controller } = setup({ fillerDelayMs: 800 });
      cover.start();
      controller.abort();
      vi.advanceTimersByTime(10_000);
      expect(sendText).not.toHaveBeenCalled();
    });

    it("カスタム文言プールを使う", () => {
      const { cover, sendText } = setup(
        { fillerDelayMs: 0, thinkingFillers: ["どれどれ"] },
        "駅はどこ",
      );
      cover.start();
      expect(sendText).toHaveBeenCalledWith("どれどれ", true, {
        preemptible: true,
        interruptible: true,
      });
    });
  });

  describe("保留音", () => {
    it("遅延 0 でも待機を伝え終わってから流す", () => {
      const { cover, sendText, sendPlay } = setup({
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

    it("holdAudioEnabled が false でも待機を伝え、保留音だけ流さない", () => {
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
      const { cover, sendPlay } = setup({ holdDelayMs: 1_000 });
      cover.onToolCall();
      cover.onToken();
      vi.advanceTimersByTime(10_000);
      expect(sendPlay).not.toHaveBeenCalled();
    });

    it("再生中の二重 onToolCall では重ねて流さない", () => {
      const { cover, sendText, sendPlay } = setup({ holdDelayMs: 0 });
      cover.onToolCall();
      cover.onToolCall();
      vi.advanceTimersByTime(3_000);
      expect(sendText).toHaveBeenCalledTimes(1);
      expect(sendPlay).toHaveBeenCalledTimes(1);
    });

    it("トークン再開後の再検索では改めて流せる", () => {
      const { cover, sendPlay } = setup({
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
