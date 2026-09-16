export const TOPICS = [
  "交通",
  "買い物",
  "医療",
  "除雪",
  "教育",
  "行政",
  "観光",
  "生活",
  "その他",
] as const;
export type PersonaTopic = (typeof TOPICS)[number];

export const SEGMENTS = [
  "観光客",
  "移住検討者",
  "帰省者",
  "村内住民",
  "村外",
  "不明セグメント",
] as const;
export type Segment = (typeof SEGMENTS)[number];

// 配列順は排他分類の優先順位（具体的な関係性が先、居住地由来が後）。
// 「観光」「旅行」単体は tags でトピック語として使われるため含めない
const SEGMENT_KEYWORDS: [Segment, string[]][] = [
  [
    "観光客",
    ["観光客", "旅行者", "旅行検討者", "観光検討者", "訪問検討者", "旅行客"],
  ],
  ["移住検討者", ["移住検討者", "移住希望", "移住を検討"]],
  ["帰省者", ["帰省"]],
  ["村内住民", ["村人", "村内", "移住者"]],
  ["村外", ["村外"]],
];

export const SENTIMENTS = [
  "positive",
  "negative",
  "request",
  "neutral",
] as const;
export type PersonaSentiment = (typeof SENTIMENTS)[number];

export const personaAttributes = (row: {
  tags: string | null;
  demographicSummary: string | null;
}) => [row.tags, row.demographicSummary].filter(Boolean).join(",");

export const classifySegment = (attributes: string) =>
  SEGMENT_KEYWORDS.find(([, keywords]) =>
    keywords.some((keyword) => attributes.includes(keyword)),
  )?.[0] ?? "不明セグメント";

export const normalizeSentiment = (sentiment: string | null) =>
  SENTIMENTS.includes(sentiment as PersonaSentiment)
    ? (sentiment as PersonaSentiment)
    : "neutral";

export const normalizeTopic = (topic: string | null) =>
  TOPICS.includes(topic as PersonaTopic) ? (topic as PersonaTopic) : "その他";
