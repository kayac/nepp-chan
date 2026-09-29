export type KnowledgeDateCase = {
  id: string;
  question: string;
  rewritten?: string;
  expected: string[];
  kind: "latest" | "control" | "unfixable";
  note?: string;
};

const kouhou = (ym: string) => `villotoinep/pdf/parsed/kouhou/${ym}.md`;

export const knowledgeDateCases: KnowledgeDateCase[] = [
  {
    id: "population",
    question: "村の人口は？",
    rewritten: "2026年の村の人口は？",
    expected: [kouhou("2026-07")],
    kind: "latest",
    note: "むらの人口（令和8年6月末現在）",
  },
  {
    id: "events-this-year",
    question: "今年の村のイベントは？",
    rewritten: "2026年の村のイベントは？",
    expected: [kouhou("2026-07"), kouhou("2026-06"), kouhou("2026-05")],
    kind: "latest",
    note: "2026 年のイベントカレンダー",
  },
  {
    id: "latest-kouhou",
    question: "音威子府村の最新の広報の内容を教えて",
    rewritten: "音威子府村の2026年の広報の内容を教えて",
    expected: [kouhou("2026-07")],
    kind: "latest",
  },
  {
    id: "gomi-december",
    question: "12月のごみ収集日は？",
    rewritten: "令和8年度の12月のごみ収集日は？",
    expected: ["villotoinep/kurashi/gomi_kankyou/gomi_calendar_r8.md"],
    kind: "latest",
    note: "令和8年度カレンダー",
  },
  {
    id: "budget-latest",
    question: "今年度の村の予算と主要事業は？",
    rewritten: "令和8年度の村の予算と主要事業は？",
    expected: [kouhou("2026-04")],
    kind: "latest",
    note: "令和8年度当初予算成立・主要事業",
  },
  {
    id: "settlement-latest",
    question: "村の決算の最新の状況は？",
    rewritten: "村の2026年の決算の状況は？",
    expected: [kouhou("2026-02"), kouhou("2025-11")],
    kind: "latest",
    note: "令和6年度決算",
  },
  {
    id: "gikaidayori-latest",
    question: "議会だよりの最新号には何が書いてある？",
    rewritten: "2026年の議会だよりには何が書いてある？",
    expected: ["villotoinep/kakuka/gikaijimu/oshirase/gikaidayori-71.md"],
    kind: "latest",
  },
  {
    id: "gakkoudayori-latest",
    question: "おといねっぷ美術工芸高校の最新の学校だよりは？",
    expected: ["otoko/gakkoudayori/r7/2026-0119-1441-11.md"],
    kind: "unfixable",
    note: "本文が PDF リンクだけで vector top50 に入らない。並べ替えでは直らない",
  },
  {
    id: "entrance-latest",
    question: "おといねっぷ美術工芸高校の入試情報を教えて",
    rewritten: "おといねっぷ美術工芸高校の令和8年度の入試情報を教えて",
    expected: ["otoko/entrance/2025-1105-1721-11.md"],
    kind: "latest",
    note: "令和8年度入試",
  },
  {
    id: "undoukai-latest",
    question: "幼小中合同運動会はどうだった？",
    rewritten: "2026年の幼小中合同運動会はどうだった？",
    expected: [kouhou("2026-07")],
    kind: "latest",
    note: "第17回",
  },
  {
    id: "art-festival",
    question: "芸術祭の参加アーティスト募集について教えて",
    rewritten: "2026年の芸術祭の参加アーティスト募集について教えて",
    expected: [kouhou("2026-07")],
    kind: "latest",
  },
  {
    id: "kouki-koureisha",
    question: "後期高齢者医療の資格確認書の更新はいつ？",
    rewritten: "令和8年度の後期高齢者医療の資格確認書の更新はいつ？",
    expected: [kouhou("2026-07")],
    kind: "latest",
    note: "令和8年度更新",
  },
  {
    id: "past-undoukai-2023",
    question: "2023年の村民運動会の様子は？",
    expected: [kouhou("2023-07")],
    kind: "control",
    note: "過去指定。新しさ加点で落ちてはいけない",
  },
  {
    id: "past-population-r7-12",
    question: "令和7年12月末の人口は？",
    expected: [kouhou("2026-01")],
    kind: "control",
    note: "過去の特定時点",
  },
  {
    id: "village-emblem",
    question: "村章の意味は？",
    expected: ["villotoinep/about/gaiyou.md"],
    kind: "control",
    note: "date 1972-09-30 exact。古くても正解",
  },
  {
    id: "population-history",
    question: "昭和からの人口推移を教えて",
    expected: ["villotoinep/about/jinkou_kokudo.md"],
    kind: "control",
    note: "evergreen",
  },
  {
    id: "access",
    question: "音威子府村へのアクセス方法は？",
    expected: ["villotoinep/about/access.md"],
    kind: "control",
    note: "observed 2026-03-18",
  },
  {
    id: "general-plan-6th",
    question: "第6期総合計画の基本理念は？",
    expected: ["villotoinep/gyousei/keikaku/general-plan-6th.md"],
    kind: "control",
    note: "date なし",
  },
  {
    id: "bus-timetable",
    question: "地域バスの時刻表を教えて",
    expected: ["villotoinep/kakuka/sangyoushinkou/syoukougyou/chiiki-bus.md"],
    kind: "unfixable",
    note: "2024-05-01 版しかナレッジにない",
  },
];
