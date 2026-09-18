type Timer = ReturnType<typeof setTimeout>;

export type ProgressStep = { atMs: number; content: string };

// GPT-Live が言い換えて話す前提なので、文そのものは短く保つ。
export const DELEGATION_PROGRESS_STEPS: ProgressStep[] = [
  { atMs: 8_000, content: "まだ調べてる途中。もうちょっとだけ待ってほしい。" },
  { atMs: 16_000, content: "もう少しで分かりそう。あと少し待ってね。" },
];

type Params = {
  steps?: ProgressStep[];
  signal?: AbortSignal;
  send: (content: string, step: { index: number; atMs: number }) => void;
};

// delegation の応答を待つ間の沈黙に、途中経過を差し込む 1 ターン分のタイマー。
export const createDelegationProgress = ({
  steps = DELEGATION_PROGRESS_STEPS,
  signal,
  send,
}: Params) => {
  const timers: Timer[] = [];

  return {
    start: () => {
      steps.forEach((step, index) => {
        timers.push(
          setTimeout(() => {
            if (signal?.aborted) return;
            send(step.content, { index, atMs: step.atMs });
          }, step.atMs),
        );
      });
    },
    dispose: () => {
      for (const timer of timers) clearTimeout(timer);
      timers.length = 0;
    },
  };
};
