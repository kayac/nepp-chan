import { describe, expect, it } from "vitest";
import { reconstructQuestion } from "./live-transcript";

describe("reconstructQuestion", () => {
  it("窓に収まる断片を到着順に結合する", () => {
    expect(
      reconstructQuestion({
        fragments: [
          { text: "音威子府そばって", startMs: 1000, endMs: 1600 },
          { text: "どこで食べられる？", startMs: 1600, endMs: 2200 },
        ],
        sinceMs: 0,
        untilMs: 2500,
      }),
    ).toBe("音威子府そばってどこで食べられる？");
  });

  it("直前のターンの断片は sinceMs より前として除く", () => {
    expect(
      reconstructQuestion({
        fragments: [
          { text: "こんにちは", startMs: 0, endMs: 500 },
          { text: "そばのこと教えて", startMs: 3000, endMs: 3800 },
        ],
        sinceMs: 2000,
        untilMs: 4000,
      }),
    ).toBe("そばのこと教えて");
  });

  it("delegation より後に届いた断片は除く", () => {
    expect(
      reconstructQuestion({
        fragments: [
          { text: "天気どう？", startMs: 1000, endMs: 1500 },
          { text: "あ、ちがった", startMs: 5000, endMs: 5500 },
        ],
        sinceMs: 0,
        untilMs: 2000,
      }),
    ).toBe("天気どう？");
  });

  it("sinceMs をまたぐ断片は残す（質問の最初の語が落ちない）", () => {
    expect(
      reconstructQuestion({
        fragments: [{ text: "音威子府の", startMs: 1800, endMs: 2400 }],
        sinceMs: 2000,
        untilMs: 3000,
      }),
    ).toBe("音威子府の");
  });

  it("untilMs をまたぐ断片は残す（質問の最後の語が落ちない）", () => {
    expect(
      reconstructQuestion({
        fragments: [{ text: "人口は何人？", startMs: 2800, endMs: 3400 }],
        sinceMs: 0,
        untilMs: 3000,
      }),
    ).toBe("人口は何人？");
  });

  it("sinceMs にちょうど終わる断片は前のターンとして除く", () => {
    expect(
      reconstructQuestion({
        fragments: [{ text: "うん", startMs: 1500, endMs: 2000 }],
        sinceMs: 2000,
        untilMs: 3000,
      }),
    ).toBe("");
  });

  it("start_ms / end_ms を持たない断片は窓に置けないので残す", () => {
    expect(
      reconstructQuestion({
        fragments: [
          { text: "そばって" },
          { text: "美味しい？", startMs: 1000, endMs: 1500 },
        ],
        sinceMs: 0,
        untilMs: 2000,
      }),
    ).toBe("そばって美味しい？");
  });

  it("片方の時刻しか無い断片も窓で判定する", () => {
    expect(
      reconstructQuestion({
        fragments: [
          { text: "前のターン", endMs: 900 },
          { text: "今の質問", startMs: 2500 },
        ],
        sinceMs: 1000,
        untilMs: 3000,
      }),
    ).toBe("今の質問");
  });

  it("前後の空白を落とす", () => {
    expect(
      reconstructQuestion({
        fragments: [{ text: "  そば  ", startMs: 0, endMs: 100 }],
        sinceMs: 0,
        untilMs: 200,
      }),
    ).toBe("そば");
  });

  it("窓に何も無ければ空文字を返す", () => {
    expect(
      reconstructQuestion({ fragments: [], sinceMs: 0, untilMs: 1000 }),
    ).toBe("");
  });
});
