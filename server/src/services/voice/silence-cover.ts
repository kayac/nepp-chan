import type { BridgeConfig } from "./bridge-config";
import { pickFiller } from "./filler";

type Timer = ReturnType<typeof setTimeout>;

type Params = {
  config: BridgeConfig;
  promptText: string;
  signal?: AbortSignal;
  nextFillerIndex: () => number;
  sendText: (
    token: string,
    last?: boolean,
    options?: { preemptible?: boolean; interruptible?: boolean },
  ) => void;
  sendPlay: (
    source: string,
    options: { loop: number; preemptible: boolean; interruptible: boolean },
  ) => void;
};

// 応答待ちの沈黙をフィラー発話と保留音で埋める、1ターン分の状態機械。
// 遅延中に応答か保留音が始まればフィラーは省略し、応答トークンが届いたら予約をすべて取り消す。
export const createSilenceCover = ({
  config,
  promptText,
  signal,
  nextFillerIndex,
  sendText,
  sendPlay,
}: Params) => {
  let fillerTimer: Timer | null = null;
  let holdTimer: Timer | null = null;
  let holdPlaying = false;

  const clearFillerTimer = () => {
    if (!fillerTimer) return;
    clearTimeout(fillerTimer);
    fillerTimer = null;
  };

  const clearHoldTimer = () => {
    if (!holdTimer) return;
    clearTimeout(holdTimer);
    holdTimer = null;
  };

  const sendFiller = () =>
    sendText(
      pickFiller(promptText, nextFillerIndex(), {
        thinking: config.thinkingFillers,
        backchannel: config.backchannelFillers,
      }),
      true,
      { preemptible: true, interruptible: true },
    );

  const playHold = () => {
    holdTimer = null;
    if (signal?.aborted || holdPlaying) return;
    holdPlaying = true;
    // 保留音が流れるならフィラーはもう不要。
    clearFillerTimer();
    // 開いたテキストターン中は play が無視されるため、last:true で閉じてから保留音を流す。
    sendText("", true);
    sendPlay(config.holdAudioUrl, {
      loop: 0,
      preemptible: true,
      interruptible: true,
    });
  };

  return {
    start: () => {
      if (!config.fillerEnabled) return;
      if (config.fillerDelayMs > 0) {
        fillerTimer = setTimeout(() => {
          fillerTimer = null;
          if (signal?.aborted) return;
          sendFiller();
        }, config.fillerDelayMs);
      } else {
        sendFiller();
      }
    },
    onToolCall: () => {
      if (!config.holdAudioEnabled || holdPlaying || holdTimer) return;
      if (config.holdDelayMs > 0) {
        holdTimer = setTimeout(playHold, config.holdDelayMs);
      } else {
        playHold();
      }
    },
    onToken: () => {
      holdPlaying = false;
      clearFillerTimer();
      clearHoldTimer();
    },
    dispose: () => {
      clearFillerTimer();
      clearHoldTimer();
    },
  };
};
