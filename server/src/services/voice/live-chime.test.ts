import { describe, expect, it } from "vitest";
import { buildChimeFrames } from "./live-chime";

const bytesOf = (frame: string) =>
  Uint8Array.from(atob(frame), (c) => c.charCodeAt(0));

// μ-law は指数部が大きいほど振幅が大きい。
const peakLevel = (frame: string) =>
  Math.max(...Array.from(bytesOf(frame), (b) => (~b & 0x70) >> 4));

describe("buildChimeFrames", () => {
  it("長さから 20ms 刻みのフレーム数を決める", () => {
    expect(buildChimeFrames({ ms: 400 })).toHaveLength(20);
    expect(buildChimeFrames({ ms: 100 })).toHaveLength(5);
  });

  it("各フレームは Twilio の 20ms 分（160 サンプル）", () => {
    for (const frame of buildChimeFrames({ ms: 100 })) {
      expect(bytesOf(frame)).toHaveLength(160);
    }
  });

  it("先頭は無音ではない", () => {
    const [first] = buildChimeFrames();
    expect(bytesOf(first).every((b) => b === 0xff)).toBe(false);
    expect(peakLevel(first)).toBeGreaterThan(0);
  });

  it("減衰して末尾は先頭より小さくなる", () => {
    const frames = buildChimeFrames();
    expect(peakLevel(frames.at(-1) ?? "")).toBeLessThan(peakLevel(frames[0]));
  });

  it("振幅を 0 にすると全サンプルが μ-law の無音になる", () => {
    const [first] = buildChimeFrames({ amplitude: 0, ms: 100 });
    expect(bytesOf(first).every((b) => b === 0xff)).toBe(true);
  });
});
