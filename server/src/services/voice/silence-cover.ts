import type { BridgeConfig } from "./bridge-config";
import { pickFiller } from "./filler";

type Timer = ReturnType<typeof setTimeout>;

const WAITING_PHRASE_DURATION_MS = 3_000;

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
  let waitingSpoken = false;

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
      if (!waitingSpoken) {
        waitingSpoken = true;
        clearFillerTimer();
        sendText("ちょっと待ってね", true, {
          preemptible: false,
          interruptible: true,
        });
      }
      if (!config.holdAudioEnabled || holdPlaying || holdTimer) return;
      holdTimer = setTimeout(
        playHold,
        Math.max(config.holdDelayMs, WAITING_PHRASE_DURATION_MS),
      );
    },
    onToken: () => {
      holdPlaying = false;
      waitingSpoken = false;
      clearFillerTimer();
      clearHoldTimer();
    },
    dispose: () => {
      clearFillerTimer();
      clearHoldTimer();
    },
  };
};
