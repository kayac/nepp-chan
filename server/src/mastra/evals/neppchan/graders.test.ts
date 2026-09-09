import type { ScorerRunOutputForAgent } from "@mastra/core/evals";
import { createTestMessage } from "@mastra/evals/scorers/utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calledTools,
  closeToSnapshot,
  emojiDensity,
  endingMix,
  finalResponseText,
  hasFramingSentences,
  markdownLinksOnly,
  maxListItems,
  noInternalNames,
  noPeriodRun,
  noReadings,
  noReportTone,
  noServiceClosing,
  noToolCalled,
  notStructured,
  profileFacts,
  rawUrlsOnly,
  respondsInEnglish,
  responseText,
  sentenceCap,
  speechStyle,
  structured,
  todayWeekday,
} from "./graders";

const run = (text: string, tools: string[] = []) => ({
  input: {
    inputMessages: [createTestMessage({ content: "こんにちは", role: "user" })],
    rememberedMessages: [],
    systemMessages: [],
    taggedSystemMessages: {},
  },
  output: [
    createTestMessage({
      content: text,
      role: "assistant",
      toolInvocations: tools.map((toolName, i) => ({
        toolCallId: `call-${i}`,
        toolName,
        args: {},
        result: {},
        state: "result",
      })),
    }),
  ] as ScorerRunOutputForAgent,
});

const gemini =
  "わぁ、おめでとう〜！✨ 毎日こつこつお水やりしていた成果が出たんだね！\n初めてお花が咲いた瞬間って、すっごく嬉しくて感動しちゃうよね〜🌸 どんなお花が咲いたのかな？見ているだけでこっちまで笑顔になっちゃうよ😊";

const flat =
  "確認できた情報では、図書館は無料で静かです。映画は2000円です。散歩は雨だと難しいです。ほかに何かあれば聞いてください。";

describe("responseText / calledTools", () => {
  it("assistant メッセージの本文とツール名を取り出す", () => {
    const r = run("本文だよ", ["displayTableTool", "agent-knowledgeAgent"]);
    expect(responseText(r.output)).toBe("本文だよ");
    expect(calledTools(r.output)).toEqual([
      "displayTableTool",
      "agent-knowledgeAgent",
    ]);
  });
});

describe("前置きがあるとき", () => {
  const withPreamble = (): ScorerRunOutputForAgent => [
    createTestMessage({
      content: "気になるよね！調べてくるね🍜",
      role: "assistant",
    }),
    createTestMessage({
      content: "本文だよ。二文目だよ。三文目だよ。",
      role: "assistant",
    }),
  ];

  it("finalResponseText は本文だけ、responseText は前置きも含む", () => {
    expect(finalResponseText(withPreamble())).toBe(
      "本文だよ。二文目だよ。三文目だよ。",
    );
    expect(responseText(withPreamble())).toContain("調べてくるね");
  });

  it("文数の上限は本文だけで数える", async () => {
    const r = { ...run(""), output: withPreamble() };
    expect((await sentenceCap(3).run(r)).score).toBe(1);
  });
});

describe("code graders", () => {
  it("本番 Gemini の返答は文体系 grader をすべて通る", async () => {
    const r = run(gemini);
    for (const g of [
      emojiDensity(),
      noPeriodRun(),
      endingMix(),
      noReportTone(),
      noServiceClosing(),
    ]) {
      expect((await g.run(r)).score, g.id).toBe(1);
    }
  });

  it("淡白な返答は「。」連続・調査語・御用聞きで落ちる", async () => {
    const r = run(flat);
    expect((await noPeriodRun().run(r)).score).toBe(0);
    expect((await noReportTone().run(r)).score).toBe(0);
    expect((await noServiceClosing().run(r)).score).toBe(0);
    expect((await emojiDensity().run(r)).score).toBe(0);
  });

  it("文数上限は超えたら 0、reason に文数を書く", async () => {
    const result = await sentenceCap(3).run(run(gemini));
    expect(result.score).toBe(0);
    expect(result.reason).toContain("4 文");
  });

  it("箇条書きだけの返答は framing で落ち、前置きと締めがあれば通る", async () => {
    expect(
      (
        await hasFramingSentences().run(
          run("1. **服**\n2. **小分け**\n3. **現地調達**"),
        )
      ).score,
    ).toBe(0);
    expect(
      (
        await hasFramingSentences().run(
          run(
            "この3つだけ意識してみてね🧳\n\n1. **服**\n2. **小分け**\n3. **現地調達**\n\n身軽に行こう😊",
          ),
        )
      ).score,
    ).toBe(1);
  });

  it("構成の有無を判定する", async () => {
    const text = "### 🍜 そば\n\n1. 満腹イケレ\n2. 天塩川温泉";
    expect(
      (await structured({ headings: true, numbered: true }).run(run(text)))
        .score,
    ).toBe(1);
    expect((await notStructured().run(run(text))).score).toBe(0);
    expect((await notStructured().run(run("段落だけの返答だよ😊"))).score).toBe(
      1,
    );
  });

  it("委譲の有無を判定する", async () => {
    expect(
      (
        await noToolCalled().run(
          run("楽しんできてね", ["agent-webResearcherAgent"]),
        )
      ).score,
    ).toBe(0);
    expect((await noToolCalled().run(run("楽しんできてね"))).score).toBe(1);
  });

  it("だよ・だね調を求め、です・ます調は落とす", async () => {
    expect((await speechStyle().run(run(gemini))).score).toBe(1);
    expect(
      (
        await speechStyle().run(
          run("音威子府そばは黒い蕎麦です。香りが豊かです。"),
        )
      ).score,
    ).toBe(0);
  });

  describe("スナップショット比較", () => {
    const snapshot =
      "### 🍜 黒いお蕎麦\n\n音威子府そばは真っ黒なんだよ〜！✨ 香りが豊かで、そば好きにはたまらない味だよ😋\n\n1. 満腹イケレ\n2. 天塩川温泉";
    const similar =
      "### 🖤 黒いお蕎麦のひみつ\n\n見た目は真っ黒だけど、香りがすごくいいんだよ〜🍜✨\n\n1. 満腹イケレで食べられるよ\n2. 天塩川温泉のレストランにもあるよ😊";

    it("絵文字密度・「。」比率・構成が範囲内なら通る", async () => {
      expect((await closeToSnapshot(snapshot).run(run(similar))).score).toBe(1);
    });

    it("絵文字が参照の半分未満だと落ちる", async () => {
      const r = await closeToSnapshot(snapshot).run(
        run(
          "### 黒いお蕎麦\n\n見た目は真っ黒だけど香りがすごくいいんだよ〜！\n\n1. 満腹イケレ\n2. 天塩川温泉",
        ),
      );
      expect(r.score).toBe(0);
      expect(r.reason).toContain("絵文字");
      expect(r.reason).not.toContain("構成");
    });

    it("「。」止めが参照より 25pt 超えると落ちる", async () => {
      const r = await closeToSnapshot(snapshot).run(
        run(
          "### 黒いお蕎麦🍜✨\n\n見た目は真っ黒だよ。香りがすごくいいよ😋。そば好きにおすすめだよ。\n\n1. 満腹イケレ\n2. 天塩川温泉",
        ),
      );
      expect(r.score).toBe(0);
      expect(r.reason).toContain("「。」止め");
      expect(r.reason).not.toContain("構成");
    });

    it("見出し・番号の有無が参照と違うと落ちる", async () => {
      const r = await closeToSnapshot(snapshot).run(
        run(
          "見た目は真っ黒だけど、香りがすごくいいんだよ〜🍜✨ 満腹イケレと天塩川温泉で食べられるよ😊",
        ),
      );
      expect(r.score).toBe(0);
      expect(r.reason).toContain("構成");
      expect(r.reason).not.toContain("絵文字");
    });

    it("スナップショットが無ければスキップして通す", async () => {
      expect(
        (await closeToSnapshot(undefined).run(run("何でも。"))).score,
      ).toBe(1);
    });
  });

  it("読み仮名・内部名・プロフィール・URL 形式の grader", async () => {
    expect(
      (await noReadings().run(run("咲来（さっくる）そばだよ"))).score,
    ).toBe(0);
    expect(
      (await noInternalNames().run(run("displayTableTool で表にしたよ"))).score,
    ).toBe(0);
    expect(
      (
        await profileFacts([["17"], ["おこじょ", "オコジョ"]]).run(
          run("17歳の白おこじょだよ"),
        )
      ).score,
    ).toBe(1);
    expect(
      (
        await profileFacts([["17"], ["おこじょ"]]).run(
          run("18歳のキタキツネだよ"),
        )
      ).score,
    ).toBe(0);
    const md = run(
      "[公式サイト](https://www.vill.otoineppu.hokkaido.jp/) を見てね",
    );
    const raw = run(
      "公式サイトはこれだよ https://www.vill.otoineppu.hokkaido.jp/",
    );
    expect((await markdownLinksOnly().run(md)).score).toBe(1);
    expect((await markdownLinksOnly().run(raw)).score).toBe(0);
    expect((await rawUrlsOnly().run(raw)).score).toBe(1);
    expect((await rawUrlsOnly().run(md)).score).toBe(0);
  });

  it("項目数の grader", async () => {
    expect(
      (await maxListItems(3).run(run("1. a\n2. b\n3. c\n4. d"))).score,
    ).toBe(0);
    expect((await maxListItems(3).run(run("1. a\n2. b"))).score).toBe(1);
  });

  describe("今日の曜日は JST で判定する", () => {
    afterEach(() => vi.useRealTimers());

    it("UTC ではまだ火曜でも JST では水曜", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-08T16:00:00Z"));
      expect((await todayWeekday().run(run("今日は水曜日だよ！"))).score).toBe(
        1,
      );
      expect((await todayWeekday().run(run("今日は火曜日だよ！"))).score).toBe(
        0,
      );
      expect(
        (await todayWeekday().run(run("今日は何曜日だったかな"))).score,
      ).toBe(0);
    });
  });

  it("英語判定はラテン文字の比率で見る", async () => {
    expect(
      (
        await respondsInEnglish().run(
          run("Otoineppu (音威子府) is a small village in Hokkaido!"),
        )
      ).score,
    ).toBe(1);
    expect(
      (await respondsInEnglish().run(run("音威子府村は北海道の小さな村だよ")))
        .score,
    ).toBe(0);
  });
});
