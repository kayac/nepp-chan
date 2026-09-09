import { describe, expect, it } from "vitest";
import {
  casualEndingCount,
  countChars,
  countEmoji,
  emojiPer100,
  endingCounts,
  endingOf,
  exclamationShare,
  framingSentenceCount,
  hasBrightEmoji,
  hasHeadings,
  hasMarkdown,
  hasNumberedList,
  hasPlaceholderName,
  internalNames,
  listItemCount,
  longestPeriodRun,
  markdownLinkCount,
  politeEndingCount,
  rawUrlCount,
  readingAnnotations,
  reportTonePhrases,
  sentences,
  serviceClosingPhrases,
  timeTokenCount,
} from "./text";

const gemini =
  "わぁ、おめでとう〜！✨ 毎日こつこつお水やりしていた成果が出たんだね！\n初めてお花が咲いた瞬間って、すっごく嬉しくて感動しちゃうよね〜🌸 どんなお花が咲いたのかな？見ているだけでこっちまで笑顔になっちゃうよ😊";

const flat =
  "調べたところ、音威子府村向けの最新ページは確認できたんだけど、こちらでは気温や降水確率の数値まで読み取れなかったよ。もう一度、気象庁の情報を中心に確認してみるね。今回の検索では断定できない。";

describe("sentences / endings", () => {
  it("句点・感嘆符・疑問符・絵文字で文を区切り、末尾で分類する", () => {
    expect(sentences(gemini)).toHaveLength(4);
    expect(endingCounts(gemini)).toEqual({
      period: 0,
      exclamation: 2,
      question: 1,
      wave: 0,
      emoji: 1,
      other: 0,
    });
  });

  it("英語はピリオドと空白で文を区切る", () => {
    expect(
      sentences("Hello there. Thanks a lot. See you at 10:00 tomorrow!"),
    ).toHaveLength(3);
    expect(sentences("価格は 2.5 倍だよ。")).toHaveLength(1);
  });

  it("異体字セレクタ付きの絵文字でも絵文字止めと語尾を判定する", () => {
    expect(endingOf("そうだよ❤️")).toBe("emoji");
    expect(casualEndingCount("そうだよ❤️\nいいよね✨")).toBe(2);
    expect(politeEndingCount("そうです❤️")).toBe(1);
  });

  it("「。」が連続する長さを数える", () => {
    expect(longestPeriodRun(flat)).toBe(3);
    expect(longestPeriodRun(gemini)).toBe(0);
  });

  it("「！」止めの比率を返す", () => {
    expect(exclamationShare(gemini)).toBeCloseTo(0.5);
    expect(exclamationShare("")).toBe(0);
  });
});

describe("emoji", () => {
  it("太字記号と空白を除いた文字数で密度を出す", () => {
    expect(countEmoji(gemini)).toBe(3);
    expect(countChars("**太字** です")).toBe(4);
    expect(countChars("嬉しいな✨🧑‍🎨 やったね☀️")).toBe(8);
    expect(emojiPer100(gemini)).toBeGreaterThan(2.5);
    expect(emojiPer100("")).toBe(0);
  });

  it("明るい絵文字だけを検出する", () => {
    expect(hasBrightEmoji("よかったね✨")).toBe(true);
    expect(hasBrightEmoji("つらかったね……🍵")).toBe(false);
  });
});

describe("phrases", () => {
  it("調査報告調の語を列挙し、国勢調査のような一般語は拾わない", () => {
    expect(reportTonePhrases(flat)).toEqual(["今回の検索"]);
    expect(
      reportTonePhrases(
        "詳しい作り方までは公開されてないみたいで、断定はできないんだ",
      ),
    ).toEqual([]);
    expect(reportTonePhrases("国勢調査では706人だよ")).toEqual([]);
  });

  it("御用聞きの定型句は末尾 2 文だけを見る", () => {
    expect(
      serviceClosingPhrases(
        "手伝えることがあれば言ってね。ところで今日は晴れだよ！村は静かだよ〜。",
      ),
    ).toEqual([]);
    expect(
      serviceClosingPhrases("今日は晴れだよ！ほかに何かあったら言ってね😊"),
    ).toEqual(["ほかに何か"]);
  });
});

describe("structure", () => {
  const structured =
    "今日は半袖がよさそうだよ〜！\n\n### 🧥 服装\n\n1. **トップス**：半袖\n2. **羽織り**：カーディガン\n\n快適に過ごしてね😊";

  it("見出し・番号付きリスト・Markdown を検出する", () => {
    expect(hasHeadings(structured)).toBe(true);
    expect(hasNumberedList(structured)).toBe(true);
    expect(hasMarkdown(structured)).toBe(true);
    expect(hasMarkdown("URLはこれだよ https://example.com")).toBe(false);
  });

  it("箇条書きの前後に文があるかを 0〜2 で返す", () => {
    expect(framingSentenceCount(structured)).toBe(2);
    expect(
      framingSentenceCount("1. **服**\n2. **小分け**\n3. **現地調達**"),
    ).toBe(0);
    expect(framingSentenceCount("文だけの返答だよ")).toBe(0);
  });

  it("「」で囲まれた例文の中は文に数えない", () => {
    const withExample =
      "こんな感じでいいよ😊\n\n「〇〇です。今回初めて参加します。よろしくお願いします。」\n\nこれで十分だね✨";
    expect(sentences(withExample)).toHaveLength(2);
    expect(sentences("「ありがとう」って言われたよ！嬉しいな😊")).toHaveLength(
      2,
    );
  });

  it("絵文字だけの断片は文に数えない", () => {
    expect(
      sentences("今日もよく頑張ったね！🌸  \nひと息つこう🍵"),
    ).toHaveLength(2);
  });

  it("時刻トークンを数える", () => {
    expect(timeTokenCount("10:00 集合 → 12:00 お昼 → 14:00 映画")).toBe(3);
  });

  it("だよ・だね系とです・ます系の文末を数える", () => {
    expect(casualEndingCount(gemini)).toBeGreaterThanOrEqual(2);
    expect(politeEndingCount(gemini)).toBe(0);
    expect(politeEndingCount("黒い蕎麦です。香りが豊かです！")).toBe(2);
  });

  it("読み仮名・内部名・仮の呼称・URL 形式を検出する", () => {
    expect(
      readingAnnotations("音威子府（おといねっぷ）村の咲来（さっくる）そば"),
    ).toHaveLength(2);
    expect(readingAnnotations("音威子府村（人口588人）")).toHaveLength(0);
    expect(internalNames("knowledgeAgent に聞いてみるね")).toEqual([
      "knowledgeAgent",
    ]);
    expect(internalNames("村の情報を調べてみるね")).toEqual([]);
    expect(hasPlaceholderName("○○さん、こんにちは")).toBe(true);
    expect(hasPlaceholderName("けんちゃん、こんにちは")).toBe(false);
    const md = "[公式サイト](https://www.vill.otoineppu.hokkaido.jp/) を見てね";
    expect(markdownLinkCount(md)).toBe(1);
    expect(rawUrlCount(md)).toBe(0);
    expect(
      rawUrlCount("こちら https://www.vill.otoineppu.hokkaido.jp/ だよ"),
    ).toBe(1);
  });

  it("番号付き・箇条書きの項目数を数える", () => {
    expect(listItemCount("前置き\n1. あ\n2. い\n- う\n本文")).toBe(3);
    expect(listItemCount("段落だけ")).toBe(0);
  });
});
