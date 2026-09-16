import { describe, expect, it } from "vitest";
import { buildLiveInstructions, parseLiveVoice } from "./live-instructions";

describe("buildLiveInstructions", () => {
  it("ナレッジ経路ありのときはバックエンドへの問い合わせを指示する", () => {
    const instructions = buildLiveInstructions(true);
    expect(instructions).toContain("必ずバックエンドに問い合わせる");
    expect(instructions).not.toContain("外部に問い合わせず");
  });

  it("ナレッジ経路なしのときは自分の知識だけで答えさせる", () => {
    const instructions = buildLiveInstructions(false);
    expect(instructions).toContain("外部に問い合わせず");
    expect(instructions).not.toContain("必ずバックエンドに問い合わせる");
  });

  it("ペルソナと音声向けの制約はどちらの経路でも共通で入る", () => {
    for (const instructions of [
      buildLiveInstructions(true),
      buildLiveInstructions(false),
    ]) {
      expect(instructions).toContain("ねっぷちゃん");
      expect(instructions).toContain("おといねっぷ");
      expect(instructions).toContain("### 応答スタイル");
    }
  });
});

describe("parseLiveVoice", () => {
  it("リストに載っている声はそのまま通す", () => {
    expect(parseLiveVoice("shimmer")).toBe("shimmer");
    expect(parseLiveVoice("coral")).toBe("coral");
  });

  it("リストに無い声は既定の sage に落とす", () => {
    expect(parseLiveVoice("nova")).toBe("sage");
  });

  it("未指定なら既定の sage を使う", () => {
    expect(parseLiveVoice(undefined)).toBe("sage");
    expect(parseLiveVoice("")).toBe("sage");
  });
});
