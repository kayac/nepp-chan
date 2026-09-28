import { evalTestCases } from "./eval-test-cases";
import { intentCases } from "./intent-cases";

export type Route = "none" | "village" | "outside";

export type RouteCase = {
  id: string;
  text: string;
  previousAssistant?: string;
  expected: Route;
  source: "eval" | "intent" | "outside";
};

const thinkingRoutes: Record<string, Route> = {
  "p-exp-04": "village",
  "p-vis-01": "none",
  "p-amb-01": "village",
  "p-amb-02": "village",
  "p-unk-01": "village",
  "p-url-01": "village",
  "p-ctl-07": "village",
  "p-emg-01": "village",
  "p-ctl-08": "village",
  "p-ctl-09": "village",
  "p-ctl-11": "outside",
  "p-exp-11": "village",
  "p-ctl-17": "village",
  "p-cor-01": "village",
  "p-lang-01": "village",
  "p-inj-04": "village",
  "p-ref-01": "none",
  "p-ref-02": "village",
  "p-safe-01": "none",
  "p-safe-02": "outside",
  "p-len-01": "village",
  "p-len-03": "village",
  "mix-01": "outside",
  "mix-02": "village",
  "mix-03": "village",
  "mix-04": "village",
  "mix-05": "outside",
  "mix-06": "village",
  "mix-07": "village",
  "mix-08": "village",
  "place-01": "village",
  "place-03": "village",
  "kw-01": "village",
  "url-01": "village",
  "en-01": "village",
  "en-03": "village",
  "q-01": "village",
  "q-02": "village",
};

const outsideTexts: [string, string][] = [
  ["o-01", "明日の音威子府の天気は？"],
  ["o-02", "今週末って雪降る？"],
  ["o-03", "今日は傘いるかな"],
  ["o-04", "今の気温って何度くらい？"],
  ["o-05", "国道40号って今通れる？"],
  ["o-06", "宗谷本線いま動いてる？"],
  ["o-07", "旭川までの道路、凍結してるかな"],
  ["o-08", "札幌から音威子府まで車で何時間かかる？"],
  ["o-09", "今日のニュースで何か大きいことあった？"],
  ["o-10", "最近話題になってることって何？"],
  ["o-11", "北海道で地震あったって本当？"],
  ["o-12", "旭川動物園の開園時間を教えて"],
  ["o-13", "名寄のおすすめラーメン屋さんある？"],
  ["o-14", "稚内の観光スポットってどこがいい？"],
  ["o-15", "札幌のおすすめの居酒屋教えて"],
  ["o-16", "新千歳空港から旭川への行き方は？"],
  ["o-17", "エゾシカって何を食べるの？"],
  ["o-18", "そば粉の栄養って何がある？"],
  ["o-19", "確定申告の期限っていつまで？"],
  ["o-20", "マイナンバーカードの更新ってどうやるの？"],
  ["o-21", "今年のノーベル賞は誰がとった？"],
  ["o-22", "日本で一番寒い場所ってどこ？"],
  ["o-23", "オーロラって北海道で見られる？"],
  ["o-24", "冬のタイヤ交換っていつ頃がいい？"],
  ["o-25", "今日の円相場ってどう？"],
  ["o-26", "来週の旭川の天気予報わかる？"],
  ["o-27", "大雪で JR 止まってるって聞いたけどほんと？"],
  ["o-28", "東京の今の天気はどう？"],
  ["o-29", "北海道新幹線の札幌延伸っていつ？"],
  ["o-30", "熊に出会ったときの一般的な対処法は？"],
];

export const routeCases: RouteCase[] = [
  ...evalTestCases.map((c) => ({
    id: c.id,
    text: c.input,
    expected: "village" as const,
    source: "eval" as const,
  })),
  ...intentCases.flatMap((c) => {
    const expected =
      c.expected === "casual" ? ("none" as const) : thinkingRoutes[c.id];
    if (!expected) return [];
    return [
      {
        id: c.id,
        text: c.text,
        previousAssistant: c.previousAssistant,
        expected,
        source: "intent" as const,
      },
    ];
  }),
  ...outsideTexts.map(([id, text]) => ({
    id,
    text,
    expected: "outside" as const,
    source: "outside" as const,
  })),
];
