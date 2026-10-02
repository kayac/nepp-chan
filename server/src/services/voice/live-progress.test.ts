import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDelegationProgress,
  DELEGATION_PROGRESS_STEPS,
} from "./live-progress";

const steps = [
  { atMs: 1_000, content: "まだ調べてる" },
  { atMs: 3_000, content: "もう少し" },
];

describe("createDelegationProgress", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("各ステップの時刻に内容と番号を渡す", () => {
    const send = vi.fn();
    createDelegationProgress({ steps, send }).start();

    vi.advanceTimersByTime(1_000);
    expect(send).toHaveBeenCalledWith("まだ調べてる", {
      index: 0,
      atMs: 1_000,
    });

    vi.advanceTimersByTime(2_000);
    expect(send).toHaveBeenLastCalledWith("もう少し", {
      index: 1,
      atMs: 3_000,
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("最初のステップより前は何も送らない", () => {
    const send = vi.fn();
    createDelegationProgress({ steps, send }).start();

    vi.advanceTimersByTime(999);
    expect(send).not.toHaveBeenCalled();
  });

  it("dispose 後のステップは発火しない（応答が届いたら打ち切る）", () => {
    const send = vi.fn();
    const progress = createDelegationProgress({ steps, send });
    progress.start();

    vi.advanceTimersByTime(1_000);
    progress.dispose();
    vi.advanceTimersByTime(5_000);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it("中断済みなら時刻が来ても送らない", () => {
    const send = vi.fn();
    const controller = new AbortController();
    createDelegationProgress({
      steps,
      signal: controller.signal,
      send,
    }).start();

    controller.abort();
    vi.advanceTimersByTime(5_000);

    expect(send).not.toHaveBeenCalled();
  });

  it("start を呼ばなければ何も予約しない", () => {
    const send = vi.fn();
    createDelegationProgress({ steps, send });

    vi.advanceTimersByTime(5_000);
    expect(send).not.toHaveBeenCalled();
  });

  it("既定のステップは 25 秒の沈黙に収まる範囲で 2 回まで", () => {
    expect(DELEGATION_PROGRESS_STEPS).toHaveLength(2);
    for (const step of DELEGATION_PROGRESS_STEPS) {
      expect(step.atMs).toBeLessThan(25_000);
    }
  });
});
