import { describe, expect, it } from "vitest";
import {
  buildDelegationInput,
  lastAssistantEnd,
  recentTranscript,
  reconstructQuestion,
  type TranscriptFragment,
} from "./live-transcript";

const user = (
  text: string,
  startMs?: number,
  endMs?: number,
): TranscriptFragment => ({ role: "user", text, startMs, endMs });

const nepp = (
  text: string,
  startMs?: number,
  endMs?: number,
): TranscriptFragment => ({ role: "assistant", text, startMs, endMs });

describe("reconstructQuestion", () => {
  it("窓に収まる相手の断片を到着順に結合する", () => {
    expect(
      reconstructQuestion({
        fragments: [
          user("音威子府そばって", 1000, 1600),
          user("どこで食べられる？", 1600, 2200),
        ],
        sinceMs: 0,
        untilMs: 2500,
      }),
    ).toBe("音威子府そばってどこで食べられる？");
  });

  it("自分の発話は質問文に混ぜない", () => {
    expect(
      reconstructQuestion({
        fragments: [
          user("明日のごみの日は", 1000, 1600),
          nepp("ちょっと待ってね", 1600, 2200),
        ],
        sinceMs: 0,
        untilMs: 2500,
      }),
    ).toBe("明日のごみの日は");
  });

  it("直前のターンの断片は sinceMs より前として除く", () => {
    expect(
      reconstructQuestion({
        fragments: [user("こんにちは", 0, 500), user("そば教えて", 3000, 3800)],
        sinceMs: 2000,
        untilMs: 4000,
      }),
    ).toBe("そば教えて");
  });

  it("delegation より後に届いた断片は除く", () => {
    expect(
      reconstructQuestion({
        fragments: [
          user("天気どう？", 1000, 1500),
          user("あ、ちがった", 5000, 5500),
        ],
        sinceMs: 0,
        untilMs: 2000,
      }),
    ).toBe("天気どう？");
  });

  it("窓の境界をまたぐ断片は残す（最初と最後の語が落ちない）", () => {
    expect(
      reconstructQuestion({
        fragments: [user("音威子府の", 1800, 2400)],
        sinceMs: 2000,
        untilMs: 3000,
      }),
    ).toBe("音威子府の");
    expect(
      reconstructQuestion({
        fragments: [user("人口は何人？", 2800, 3400)],
        sinceMs: 0,
        untilMs: 3000,
      }),
    ).toBe("人口は何人？");
  });

  it("start_ms / end_ms を持たない断片は窓に置けないので残す", () => {
    expect(
      reconstructQuestion({
        fragments: [user("そばって"), user("美味しい？", 1000, 1500)],
        sinceMs: 0,
        untilMs: 2000,
      }),
    ).toBe("そばって美味しい？");
  });

  it("窓に何も無ければ空文字を返す", () => {
    expect(
      reconstructQuestion({ fragments: [], sinceMs: 0, untilMs: 1000 }),
    ).toBe("");
  });
});

describe("lastAssistantEnd", () => {
  it("まとまった発話の終わりを返す", () => {
    expect(
      lastAssistantEnd(
        [
          nepp("音威子府そばは黒い麺が特徴だよ", 1000, 3000),
          user("へえ", 3000, 3400),
        ],
        5000,
      ),
    ).toBe(3000);
  });

  it("相槌は境界にしない（質問の前半が捨てられないように）", () => {
    const fragments = [
      user("明日のごみの日って", 1000, 1800),
      nepp("うん", 1800, 2000),
      user("何が出せるんだっけ", 2000, 3000),
    ];
    expect(lastAssistantEnd(fragments, 3500)).toBe(0);
    expect(
      reconstructQuestion({
        fragments,
        sinceMs: lastAssistantEnd(fragments, 3500),
        untilMs: 3500,
      }),
    ).toBe("明日のごみの日って何が出せるんだっけ");
  });

  it("連続した断片はまとめて長さを判定する", () => {
    expect(
      lastAssistantEnd(
        [
          nepp("そう", 1000, 1200),
          nepp("なんだよねー、面白いよね", 1200, 2400),
        ],
        3000,
      ),
    ).toBe(2400);
  });

  it("untilMs より後の発話は見ない", () => {
    expect(
      lastAssistantEnd([nepp("まだ調べてる途中だよ", 4000, 5000)], 3000),
    ).toBe(0);
  });

  it("自分の発話が無ければ 0", () => {
    expect(lastAssistantEnd([user("こんにちは", 0, 500)], 1000)).toBe(0);
  });
});

describe("recentTranscript", () => {
  it("話者ラベル付きで直前までのやりとりを並べる", () => {
    expect(
      recentTranscript(
        [
          user("そばの店教えて", 1000, 2000),
          nepp("一路食堂がおすすめだよ", 2000, 3000),
          user("木曜はやってる？", 3000, 4000),
        ],
        4500,
      ),
    ).toBe(
      "相手: そばの店教えて\nねっぷ: 一路食堂がおすすめだよ\n相手: 木曜はやってる？",
    );
  });

  it("untilMs より後の発話は含めない", () => {
    expect(
      recentTranscript(
        [user("最初の質問", 1000, 2000), user("あとの発言", 9000, 9500)],
        5000,
      ),
    ).toBe("相手: 最初の質問");
  });

  it("上限を超えたら古い行から落とす", () => {
    const long = "あ".repeat(400);
    const result = recentTranscript(
      [user(long, 0, 1000), nepp(long, 1000, 2000), user("最後", 2000, 2500)],
      3000,
    );
    expect(result).toContain("相手: 最後");
    expect(result.length).toBeLessThanOrEqual(600);
  });

  it("空なら空文字", () => {
    expect(recentTranscript([], 1000)).toBe("");
  });
});

describe("buildDelegationInput", () => {
  it("文脈があれば質問の前に置く", () => {
    expect(
      buildDelegationInput("木曜はやってる？", "相手: そばの店教えて"),
    ).toBe(
      "【通話のここまでのやりとり】\n相手: そばの店教えて\n\n【調べてほしいこと】\n木曜はやってる？",
    );
  });

  it("文脈が無ければ質問だけを渡す", () => {
    expect(buildDelegationInput("そばって美味しい？", "")).toBe(
      "そばって美味しい？",
    );
  });
});
