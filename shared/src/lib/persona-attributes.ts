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

// 配列順は排他分類の優先順位（先頭一致で1つに分類する）
export const RELATIONSHIPS = [
  "村人",
  "観光客",
  "移住検討者",
  "帰省者",
] as const;
export type PersonaRelationship = (typeof RELATIONSHIPS)[number];

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

export const classifyRelationship = (attributes: string) =>
  RELATIONSHIPS.find((r) => attributes.includes(r)) ?? null;

export const normalizeSentiment = (sentiment: string | null) =>
  SENTIMENTS.includes(sentiment as PersonaSentiment)
    ? (sentiment as PersonaSentiment)
    : "neutral";

export const normalizeTopic = (topic: string | null) =>
  TOPICS.includes(topic as PersonaTopic) ? (topic as PersonaTopic) : "その他";
