// 村の声グラフの静的データ（サンプル・架空の値）
//
// 実データは含まない。件数・エンティティ名・役割はすべて創作で、
// 実在の施設・実際の集計結果とは対応しない。
// 実データ版は tmp/ のスクリプトでローカル生成して差し替える（コミット禁止）
//
// 生成ロジック（tmp/build-ontology-graph.py + tmp/generate-ontology-ts.py）:
// 1. 確定層: persona 全件を SQL で segment×topic×sentiment 集計
// 2. 役割分類: 感情構成とセグメント構成のしきい値ルールで判定
//    （争点 = pos/neg 両方 8%+、不満点/満足点 = 12%+ で偏り、
//      接続点 = 村内と村外系の双方から有意な言及）
// 3. エンティティ層: サンプル450件から LLM で固有実体を抽出・名寄せ（3件以上を採用）
// 4. 座標: spring_layout + 衝突回避パスで初期値を事前計算
//    （表示側の d3-force シミュレーションのシード）
//
// TODO: 現在は静的スナップショット。バッチ化する場合は server 側で
// 同じロジックを実装して API から配信する

export type OntologyRole =
  | "接続点"
  | "争点"
  | "不満点"
  | "満足点"
  | "関心点"
  | "セグメント";

export interface OntologyNode {
  id: string;
  label: string;
  kind: "segment" | "topic" | "entity";
  /** エンティティの種別（place / facility / service / institution / event / org） */
  type?: string;
  /** エンティティの主トピック（topic-ent エッジの接続先） */
  topic?: string;
  count: number;
  role: OntologyRole;
  roles: OntologyRole[];
  x: number;
  y: number;
  bySegment?: Record<string, number>;
  bySentiment?: Record<string, number>;
}

export interface OntologyLink {
  source: string;
  target: string;
  n: number;
  kind: "seg-topic" | "topic-ent" | "seg-ent";
}

export const ONTOLOGY_GENERATED_AT = "サンプルデータ";

export const ONTOLOGY_VIEWBOX = { width: 1200, height: 760 };

export const ONTOLOGY_META = {
  personaTotal: 1929,
  entityCount: 11,
  note: "表示中はサンプルデータ（架空の値）。実データは未接続",
};

export const ONTOLOGY_NODES: OntologyNode[] = [
  {
    id: "seg:観光客",
    label: "観光客",
    kind: "segment",
    count: 492,
    roles: [],
    role: "セグメント",
    x: 878.5,
    y: 471.6,
  },
  {
    id: "seg:村内住民",
    label: "村内住民",
    kind: "segment",
    count: 620,
    roles: [],
    role: "セグメント",
    x: 509.3,
    y: 437.2,
  },
  {
    id: "seg:移住検討者",
    label: "移住検討者",
    kind: "segment",
    count: 216,
    roles: [],
    role: "セグメント",
    x: 641.0,
    y: 286.4,
  },
  {
    id: "seg:村外",
    label: "村外",
    kind: "segment",
    count: 90,
    roles: [],
    role: "セグメント",
    x: 671.2,
    y: 227.7,
  },
  {
    id: "seg:帰省者",
    label: "帰省者",
    kind: "segment",
    count: 5,
    roles: [],
    role: "セグメント",
    x: 1052.4,
    y: 575.9,
  },
  {
    id: "seg:不明セグメント",
    label: "不明セグメント",
    kind: "segment",
    count: 506,
    roles: [],
    role: "セグメント",
    x: 577.8,
    y: 367.6,
  },
  {
    id: "top:観光",
    label: "観光",
    kind: "topic",
    count: 631,
    roles: ["関心点"],
    role: "関心点",
    bySegment: {
      観光客: 420,
      村内住民: 58,
      移住検討者: 32,
      村外: 36,
      帰省者: 1,
      不明セグメント: 84,
    },
    bySentiment: {
      neutral: 549,
      positive: 70,
      request: 12,
    },
    x: 782.3,
    y: 380.7,
  },
  {
    id: "top:交通",
    label: "交通",
    kind: "topic",
    count: 92,
    roles: ["接続点"],
    role: "接続点",
    bySegment: {
      観光客: 44,
      村内住民: 28,
      不明セグメント: 20,
    },
    bySentiment: {
      neutral: 82,
      request: 6,
      negative: 4,
    },
    x: 697.3,
    y: 498.9,
  },
  {
    id: "top:買い物",
    label: "買い物",
    kind: "topic",
    count: 87,
    roles: ["争点", "満足点", "接続点"],
    role: "争点",
    bySegment: {
      観光客: 28,
      村内住民: 59,
    },
    bySentiment: {
      neutral: 64,
      positive: 15,
      negative: 8,
    },
    x: 733.0,
    y: 559.2,
  },
  {
    id: "top:生活",
    label: "生活",
    kind: "topic",
    count: 370,
    roles: ["接続点"],
    role: "接続点",
    bySegment: {
      村内住民: 184,
      移住検討者: 116,
      帰省者: 4,
      不明セグメント: 66,
    },
    bySentiment: {
      neutral: 272,
      positive: 24,
      negative: 30,
      request: 44,
    },
    x: 622.5,
    y: 417.8,
  },
  {
    id: "top:行政",
    label: "行政",
    kind: "topic",
    count: 228,
    roles: ["接続点"],
    role: "接続点",
    bySegment: {
      村内住民: 90,
      移住検討者: 26,
      村外: 24,
      不明セグメント: 88,
    },
    bySentiment: {
      neutral: 218,
      request: 10,
    },
    x: 485.7,
    y: 296.0,
  },
  {
    id: "top:医療",
    label: "医療",
    kind: "topic",
    count: 71,
    roles: ["不満点"],
    role: "不満点",
    bySegment: {
      村内住民: 71,
    },
    bySentiment: {
      neutral: 52,
      negative: 13,
      request: 6,
    },
    x: 272.2,
    y: 495.4,
  },
  {
    id: "top:除雪",
    label: "除雪",
    kind: "topic",
    count: 26,
    roles: ["不満点"],
    role: "不満点",
    bySegment: {
      村内住民: 26,
    },
    bySentiment: {
      neutral: 15,
      negative: 8,
      request: 3,
    },
    x: 312.0,
    y: 599.3,
  },
  {
    id: "top:教育",
    label: "教育",
    kind: "topic",
    count: 166,
    roles: ["接続点"],
    role: "接続点",
    bySegment: {
      村内住民: 42,
      移住検討者: 42,
      村外: 30,
      不明セグメント: 52,
    },
    bySentiment: {
      neutral: 156,
      positive: 6,
      request: 4,
    },
    x: 547.0,
    y: 271.3,
  },
  {
    id: "top:その他",
    label: "その他",
    kind: "topic",
    count: 258,
    roles: ["満足点"],
    role: "満足点",
    bySegment: {
      村内住民: 62,
      不明セグメント: 196,
    },
    bySentiment: {
      neutral: 210,
      positive: 48,
    },
    x: 420.8,
    y: 398.6,
  },
  {
    id: "ent:起業支援窓口",
    label: "起業支援窓口",
    kind: "entity",
    type: "institution",
    topic: "行政",
    count: 6,
    roles: ["関心点"],
    role: "関心点",
    bySegment: {
      移住検討者: 6,
    },
    bySentiment: {
      neutral: 4,
      request: 2,
    },
    x: 558.0,
    y: 80.0,
  },
  {
    id: "ent:レンタサイクル",
    label: "レンタサイクル",
    kind: "entity",
    type: "service",
    topic: "交通",
    count: 8,
    roles: ["争点", "接続点"],
    role: "争点",
    bySegment: {
      観光客: 5,
      村内住民: 3,
    },
    bySentiment: {
      positive: 2,
      neutral: 4,
      negative: 2,
    },
    x: 735.4,
    y: 642.9,
  },
  {
    id: "ent:クラフトビール醸造所",
    label: "クラフトビール醸造所",
    kind: "entity",
    type: "org",
    topic: "買い物",
    count: 8,
    roles: ["満足点"],
    role: "満足点",
    bySegment: {
      観光客: 6,
      村外: 2,
    },
    bySentiment: {
      positive: 3,
      neutral: 5,
    },
    x: 967.7,
    y: 680.0,
  },
  {
    id: "ent:岬の灯台公園",
    label: "岬の灯台公園",
    kind: "entity",
    type: "place",
    topic: "観光",
    count: 8,
    roles: ["関心点"],
    role: "関心点",
    bySegment: {
      観光客: 8,
    },
    bySentiment: {
      neutral: 8,
    },
    x: 1096.3,
    y: 338.6,
  },
  {
    id: "ent:子ども科学館",
    label: "子ども科学館",
    kind: "entity",
    type: "facility",
    topic: "教育",
    count: 10,
    roles: ["接続点"],
    role: "接続点",
    bySegment: {
      村内住民: 5,
      移住検討者: 3,
      村外: 2,
    },
    bySentiment: {
      neutral: 9,
      positive: 1,
    },
    x: 402.9,
    y: 184.5,
  },
  {
    id: "ent:コミュニティFM",
    label: "コミュニティFM",
    kind: "entity",
    type: "service",
    topic: "生活",
    count: 10,
    roles: ["接続点"],
    role: "接続点",
    bySegment: {
      村内住民: 5,
      村外: 3,
      移住検討者: 2,
    },
    bySentiment: {
      neutral: 10,
    },
    x: 373.9,
    y: 295.1,
  },
  {
    id: "ent:健康アプリ",
    label: "健康アプリ",
    kind: "entity",
    type: "service",
    topic: "医療",
    count: 4,
    roles: ["関心点"],
    role: "関心点",
    bySegment: {
      村内住民: 4,
    },
    bySentiment: {
      neutral: 4,
    },
    x: 80.0,
    y: 543.8,
  },
  {
    id: "ent:公園トイレ",
    label: "公園トイレ",
    kind: "entity",
    type: "facility",
    topic: "生活",
    count: 10,
    roles: ["不満点"],
    role: "不満点",
    bySegment: {
      村内住民: 10,
    },
    bySentiment: {
      negative: 5,
      neutral: 3,
      request: 2,
    },
    x: 484.2,
    y: 591.3,
  },
  {
    id: "ent:雪あかり祭り",
    label: "雪あかり祭り",
    kind: "entity",
    type: "event",
    topic: "観光",
    count: 9,
    roles: ["満足点"],
    role: "満足点",
    bySegment: {
      観光客: 7,
      村内住民: 2,
    },
    bySentiment: {
      positive: 5,
      neutral: 4,
    },
    x: 1120.0,
    y: 431.2,
  },
  {
    id: "ent:風力発電計画",
    label: "風力発電計画",
    kind: "entity",
    type: "institution",
    topic: "行政",
    count: 11,
    roles: ["争点", "不満点"],
    role: "争点",
    bySegment: {
      村内住民: 9,
      村外: 2,
    },
    bySentiment: {
      negative: 3,
      positive: 2,
      neutral: 6,
    },
    x: 213.5,
    y: 321.8,
  },
  {
    id: "ent:海風マルシェ",
    label: "海風マルシェ",
    kind: "entity",
    type: "event",
    topic: "観光",
    count: 15,
    roles: ["満足点", "接続点"],
    role: "満足点",
    bySegment: {
      観光客: 10,
      村内住民: 5,
    },
    bySentiment: {
      neutral: 8,
      positive: 7,
    },
    x: 904.1,
    y: 365.1,
  },
];

export const ONTOLOGY_LINKS: OntologyLink[] = [
  {
    source: "seg:観光客",
    target: "top:観光",
    n: 420,
    kind: "seg-topic",
  },
  {
    source: "seg:観光客",
    target: "top:交通",
    n: 44,
    kind: "seg-topic",
  },
  {
    source: "seg:観光客",
    target: "top:買い物",
    n: 28,
    kind: "seg-topic",
  },
  {
    source: "seg:村内住民",
    target: "top:生活",
    n: 184,
    kind: "seg-topic",
  },
  {
    source: "seg:村内住民",
    target: "top:行政",
    n: 90,
    kind: "seg-topic",
  },
  {
    source: "seg:村内住民",
    target: "top:医療",
    n: 71,
    kind: "seg-topic",
  },
  {
    source: "seg:村内住民",
    target: "top:除雪",
    n: 26,
    kind: "seg-topic",
  },
  {
    source: "seg:村内住民",
    target: "top:買い物",
    n: 59,
    kind: "seg-topic",
  },
  {
    source: "seg:村内住民",
    target: "top:観光",
    n: 58,
    kind: "seg-topic",
  },
  {
    source: "seg:村内住民",
    target: "top:教育",
    n: 42,
    kind: "seg-topic",
  },
  {
    source: "seg:村内住民",
    target: "top:交通",
    n: 28,
    kind: "seg-topic",
  },
  {
    source: "seg:村内住民",
    target: "top:その他",
    n: 62,
    kind: "seg-topic",
  },
  {
    source: "seg:移住検討者",
    target: "top:生活",
    n: 116,
    kind: "seg-topic",
  },
  {
    source: "seg:移住検討者",
    target: "top:教育",
    n: 42,
    kind: "seg-topic",
  },
  {
    source: "seg:移住検討者",
    target: "top:行政",
    n: 26,
    kind: "seg-topic",
  },
  {
    source: "seg:移住検討者",
    target: "top:観光",
    n: 32,
    kind: "seg-topic",
  },
  {
    source: "seg:村外",
    target: "top:観光",
    n: 36,
    kind: "seg-topic",
  },
  {
    source: "seg:村外",
    target: "top:教育",
    n: 30,
    kind: "seg-topic",
  },
  {
    source: "seg:村外",
    target: "top:行政",
    n: 24,
    kind: "seg-topic",
  },
  {
    source: "seg:不明セグメント",
    target: "top:その他",
    n: 196,
    kind: "seg-topic",
  },
  {
    source: "seg:不明セグメント",
    target: "top:観光",
    n: 84,
    kind: "seg-topic",
  },
  {
    source: "seg:不明セグメント",
    target: "top:行政",
    n: 88,
    kind: "seg-topic",
  },
  {
    source: "seg:不明セグメント",
    target: "top:生活",
    n: 66,
    kind: "seg-topic",
  },
  {
    source: "seg:不明セグメント",
    target: "top:教育",
    n: 52,
    kind: "seg-topic",
  },
  {
    source: "seg:不明セグメント",
    target: "top:交通",
    n: 20,
    kind: "seg-topic",
  },
  {
    source: "seg:帰省者",
    target: "top:生活",
    n: 4,
    kind: "seg-topic",
  },
  {
    source: "top:行政",
    target: "ent:起業支援窓口",
    n: 6,
    kind: "topic-ent",
  },
  {
    source: "seg:移住検討者",
    target: "ent:起業支援窓口",
    n: 6,
    kind: "seg-ent",
  },
  {
    source: "top:交通",
    target: "ent:レンタサイクル",
    n: 8,
    kind: "topic-ent",
  },
  {
    source: "seg:観光客",
    target: "ent:レンタサイクル",
    n: 5,
    kind: "seg-ent",
  },
  {
    source: "seg:村内住民",
    target: "ent:レンタサイクル",
    n: 3,
    kind: "seg-ent",
  },
  {
    source: "top:買い物",
    target: "ent:クラフトビール醸造所",
    n: 8,
    kind: "topic-ent",
  },
  {
    source: "seg:観光客",
    target: "ent:クラフトビール醸造所",
    n: 6,
    kind: "seg-ent",
  },
  {
    source: "top:観光",
    target: "ent:岬の灯台公園",
    n: 8,
    kind: "topic-ent",
  },
  {
    source: "seg:観光客",
    target: "ent:岬の灯台公園",
    n: 8,
    kind: "seg-ent",
  },
  {
    source: "top:教育",
    target: "ent:子ども科学館",
    n: 10,
    kind: "topic-ent",
  },
  {
    source: "seg:村内住民",
    target: "ent:子ども科学館",
    n: 5,
    kind: "seg-ent",
  },
  {
    source: "seg:移住検討者",
    target: "ent:子ども科学館",
    n: 3,
    kind: "seg-ent",
  },
  {
    source: "top:生活",
    target: "ent:コミュニティFM",
    n: 10,
    kind: "topic-ent",
  },
  {
    source: "seg:村内住民",
    target: "ent:コミュニティFM",
    n: 5,
    kind: "seg-ent",
  },
  {
    source: "seg:村外",
    target: "ent:コミュニティFM",
    n: 3,
    kind: "seg-ent",
  },
  {
    source: "top:医療",
    target: "ent:健康アプリ",
    n: 4,
    kind: "topic-ent",
  },
  {
    source: "seg:村内住民",
    target: "ent:健康アプリ",
    n: 4,
    kind: "seg-ent",
  },
  {
    source: "top:生活",
    target: "ent:公園トイレ",
    n: 10,
    kind: "topic-ent",
  },
  {
    source: "seg:村内住民",
    target: "ent:公園トイレ",
    n: 10,
    kind: "seg-ent",
  },
  {
    source: "top:観光",
    target: "ent:雪あかり祭り",
    n: 9,
    kind: "topic-ent",
  },
  {
    source: "seg:観光客",
    target: "ent:雪あかり祭り",
    n: 7,
    kind: "seg-ent",
  },
  {
    source: "top:行政",
    target: "ent:風力発電計画",
    n: 11,
    kind: "topic-ent",
  },
  {
    source: "seg:村内住民",
    target: "ent:風力発電計画",
    n: 9,
    kind: "seg-ent",
  },
  {
    source: "top:観光",
    target: "ent:海風マルシェ",
    n: 15,
    kind: "topic-ent",
  },
  {
    source: "seg:観光客",
    target: "ent:海風マルシェ",
    n: 10,
    kind: "seg-ent",
  },
  {
    source: "seg:村内住民",
    target: "ent:海風マルシェ",
    n: 5,
    kind: "seg-ent",
  },
];
