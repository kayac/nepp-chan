import { describe, expect, it } from "vitest";
import { AIZUCHI_PHRASES, pickAizuchi, shouldSendAizuchi } from "./aizuchi";

describe("pickAizuchi", () => {
  it("index でフレーズを巡回する", () => {
    expect(pickAizuchi(0)).toBe(AIZUCHI_PHRASES[0]);
    expect(pickAizuchi(1)).toBe(AIZUCHI_PHRASES[1]);
    expect(pickAizuchi(AIZUCHI_PHRASES.length)).toBe(AIZUCHI_PHRASES[0]);
  });

  it("カスタムのフレーズを使える", () => {
    expect(pickAizuchi(1, ["はい", "ええ"])).toBe("ええ");
  });
});

describe("shouldSendAizuchi", () => {
  it("応答生成中（ターンあり）なら送らない", () => {
    expect(
      shouldSendAizuchi({
        hasActiveTurn: true,
        lastAizuchiAt: null,
        now: 1000,
        cooldownMs: 2000,
      }),
    ).toBe(false);
  });

  it("クールダウン中なら送らない", () => {
    expect(
      shouldSendAizuchi({
        hasActiveTurn: false,
        lastAizuchiAt: 1000,
        now: 2000,
        cooldownMs: 2000,
      }),
    ).toBe(false);
  });

  it("クールダウンが明けていれば送る", () => {
    expect(
      shouldSendAizuchi({
        hasActiveTurn: false,
        lastAizuchiAt: 1000,
        now: 3000,
        cooldownMs: 2000,
      }),
    ).toBe(true);
  });

  it("一度も送っていなければ送る", () => {
    expect(
      shouldSendAizuchi({
        hasActiveTurn: false,
        lastAizuchiAt: null,
        now: 1000,
        cooldownMs: 2000,
      }),
    ).toBe(true);
  });
});
