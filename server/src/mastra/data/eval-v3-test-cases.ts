/** テストケースのカテゴリ */
export type TestCategory =
  | "village-overview" // 村の概要
  | "living" // 生活情報
  | "disaster" // 防災・緊急
  | "administration" // 行政
  | "tourism" // 観光・施設
  | "education" // 教育（高校）
  | "negative"; // ネガティブ

/** テストケースのタイプ */
export type TestType = "positive" | "negative";

/** V3 テストケース */
export interface TestCaseV3 {
  /** テストケース ID（重複不可） */
  id: string;
  /** カテゴリ */
  category: TestCategory;
  /** テストタイプ（positive: 正しく回答すべき / negative: 「わからない」と答えるべき） */
  type: TestType;
  /** 質問テキスト */
  input: string;
  /** 期待される回答（正解テキスト） */
  groundTruth: string;
  /** 必須キーワード（positive=AND条件, negative=OR条件） */
  requiredKeywords: string[];
  /** 合格閾値（similarity スコアがこの値以上で pass） */
  threshold: number;
}

/** V3 テストケース（暫定3個 → 後で拡充） */
export const evalV3TestCases: TestCaseV3[] = [
  {
    id: "vo-01",
    category: "village-overview",
    type: "positive",
    input: "音威子府村の村長は誰？",
    groundTruth: "遠藤貴幸",
    requiredKeywords: ["遠藤"],
    threshold: 0.6,
  },
  {
    id: "vo-02",
    category: "village-overview",
    type: "positive",
    input: "音威子府村の人口は？",
    groundTruth: "約632人（令和5年）",
    requiredKeywords: ["人"],
    threshold: 0.5,
  },
  {
    id: "tr-01",
    category: "tourism",
    type: "positive",
    input: "音威子府そばの特徴は？",
    groundTruth: "黒い色が特徴の蕎麦",
    requiredKeywords: ["黒"],
    threshold: 0.6,
  },
];
