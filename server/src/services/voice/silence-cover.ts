import type { BridgeConfig } from "./bridge-config";
import { pickFiller } from "./filler";

type Timer = ReturnType<typeof setTimeout>;

const WAITING_PHRASE_DURATION_MS = 3_000;

export const HOLD_PHRASES = [
  "いま調べてるよ〜",
  "もうちょっと待ってね",
  "ごめんね、もう少しかかりそう",
] as const;

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
  let holdPhraseTimer: ReturnType<typeof setInterval> | null = null;
  let holdPhraseIndex = 0;
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

  const clearHoldPhraseTimer = () => {
    if (!holdPhraseTimer) return;
    clearInterval(holdPhraseTimer);
    holdPhraseTimer = null;
  };

  const startHoldPhrases = () => {
    if (holdPhraseTimer) return;
    holdPhraseTimer = setInterval(() => {
      if (signal?.aborted) return clearHoldPhraseTimer();
      const phrases = config.holdPhrases;
      sendText(phrases[holdPhraseIndex++ % phrases.length], true, {
        preemptible: false,
        interruptible: true,
      });
    }, config.holdPhraseIntervalMs);
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
      if (!config.holdAudioEnabled) {
        startHoldPhrases();
        return;
      }
      if (holdPlaying || holdTimer) return;
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
      clearHoldPhraseTimer();
    },
    dispose: () => {
      clearFillerTimer();
      clearHoldTimer();
      clearHoldPhraseTimer();
    },
  };
};
