import type { TurnClass } from "~/lib/classify-intent";
import type { BridgeConfig } from "./bridge-config";
import { pickFiller } from "./filler";
import type { PlayOptions, TextTokenOptions } from "./relay-protocol";

type Timer = ReturnType<typeof setTimeout>;

type Turn = Pick<TurnClass, "route" | "backchannel">;

const WAITING_PHRASE_DURATION_MS = 3_000;

export const HOLD_PHRASES = [
  "いま調べてるよ〜",
  "もうちょっと待ってね",
  "ごめんね、もう少しかかりそう",
] as const;

type Params = {
  config: BridgeConfig;
  signal?: AbortSignal;
  nextFillerIndex: () => number;
  sendText: (token: string, last?: boolean, options?: TextTokenOptions) => void;
  sendPlay: (source: string, options: PlayOptions) => void;
};

// 応答待ちの沈黙をフィラー発話と保留音で埋める、1ターン分の状態機械。
// 遅延中に応答か保留音が始まればフィラーは省略し、応答トークンが届いたら予約をすべて取り消す。
export const createSilenceCover = ({
  config,
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
  let responded = false;

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

  const sendFiller = (turn: Turn) => {
    const phrase = pickFiller(turn, nextFillerIndex(), config.thinkingFillers);
    if (phrase)
      sendText(phrase, true, { preemptible: false, interruptible: true });
  };

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
    start: (turn: Promise<Turn>) => {
      if (!config.fillerEnabled || responded || signal?.aborted) return;
      const fire = () =>
        turn.then((resolved) => {
          if (responded || holdPlaying || signal?.aborted) return;
          sendFiller(resolved);
        });
      if (config.fillerDelayMs > 0) {
        fillerTimer = setTimeout(() => {
          fillerTimer = null;
          void fire();
        }, config.fillerDelayMs);
      } else {
        void fire();
      }
    },
    onToolCall: () => {
      responded = true;
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
      responded = true;
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
