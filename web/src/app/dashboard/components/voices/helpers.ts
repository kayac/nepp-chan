import type {
  PersonaFilterParams,
  PersonaSentiment,
} from "@nepp-chan/shared/api/repository/persona-repository";
import type { TOPICS } from "@nepp-chan/shared/lib/persona-attributes";

import { SENTIMENT_LABELS } from "~/lib/voice";
import { periodRange, type VoicePeriod } from "~/lib/voice-period";

export type VoiceSentiment = PersonaSentiment | "emergency";
export type VoiceSort = "list" | "topics";

export type VoiceFilter = {
  period: VoicePeriod;
  sents: VoiceSentiment[];
  topic: string | null;
  sort: VoiceSort;
};

export const DEFAULT_FILTER: VoiceFilter = {
  period: "m1",
  sents: [],
  topic: null,
  sort: "list",
};

export const PERIOD_OPTIONS: { value: VoicePeriod; label: string }[] = [
  { value: "d7", label: "直近7日" },
  { value: "m1", label: "直近30日" },
  { value: "all", label: "全期間" },
];

export const SENT_OPTIONS: { value: VoiceSentiment; label: string }[] = [
  { value: "positive", label: SENTIMENT_LABELS.positive },
  { value: "negative", label: SENTIMENT_LABELS.negative },
  { value: "emergency", label: "緊急" },
  { value: "request", label: SENTIMENT_LABELS.request },
];

export const SORT_OPTIONS: { value: VoiceSort; label: string }[] = [
  { value: "list", label: "新しい順" },
  { value: "topics", label: "話題ごと" },
];

// 表示順は村の関心が高い話題から。値の網羅は helpers.test.ts で TOPICS と突き合わせる
export const TOPIC_OPTIONS = [
  "観光",
  "生活",
  "除雪",
  "行政",
  "交通",
  "買い物",
  "医療",
  "教育",
  "その他",
] satisfies (typeof TOPICS)[number][];

const sentLabel = (value: VoiceSentiment) =>
  SENT_OPTIONS.find((o) => o.value === value)?.label ?? value;

// 感情での絞り込みはサーバーに渡す。緊急はペルソナの感情ではないので落とす
export const toPersonaFilters = (
  filter: VoiceFilter,
  now: Date = new Date(),
): PersonaFilterParams => {
  const sentiments = filter.sents.filter(
    (s): s is PersonaSentiment => s !== "emergency",
  );
  return {
    ...periodRange(filter.period, now),
    ...(sentiments.length > 0 ? { sentiments } : {}),
    ...(filter.topic ? { topic: filter.topic } : {}),
  };
};

export const shouldIncludePersonas = (filter: VoiceFilter) =>
  filter.sents.length === 0 || filter.sents.some((s) => s !== "emergency");

export const shouldIncludeEmergencies = (filter: VoiceFilter) => {
  // 緊急には話題が付かないため、話題で絞ったら対象外になる
  if (filter.topic) {
    return false;
  }
  return filter.sents.length === 0 || filter.sents.includes("emergency");
};

export const appliedCount = (filter: VoiceFilter) =>
  (filter.period !== DEFAULT_FILTER.period ? 1 : 0) +
  filter.sents.length +
  (filter.topic ? 1 : 0);

export type FilterChip = { key: string; label: string };

export const activeChips = (filter: VoiceFilter): FilterChip[] => [
  ...(filter.period !== DEFAULT_FILTER.period
    ? [
        {
          key: "period",
          label:
            PERIOD_OPTIONS.find((o) => o.value === filter.period)?.label ?? "",
        },
      ]
    : []),
  ...filter.sents.map((s) => ({ key: `sent:${s}`, label: sentLabel(s) })),
  ...(filter.topic ? [{ key: "topic", label: filter.topic }] : []),
];

export const analyzeContextLabel = (filter: VoiceFilter, count: number) => {
  const periodLabel =
    PERIOD_OPTIONS.find((o) => o.value === filter.period)?.label ?? "";
  const conditions = activeChips(filter)
    .filter((c) => c.key !== "period")
    .map((c) => c.label);
  return `${[periodLabel, ...conditions].join(" × ")}・${count}件`;
};

export const removeChip = (filter: VoiceFilter, key: string): VoiceFilter => {
  if (key === "period") {
    return { ...filter, period: DEFAULT_FILTER.period };
  }
  if (key === "topic") {
    return { ...filter, topic: null };
  }
  if (key.startsWith("sent:")) {
    const value = key.slice("sent:".length);
    return { ...filter, sents: filter.sents.filter((s) => s !== value) };
  }
  return filter;
};
