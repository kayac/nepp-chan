import type {
  PersonaRelationship,
  PersonaSentiment,
} from "@nepp-chan/shared/api/repository/persona-repository";

import { startOfWeek, toDateString } from "~/lib/date";

export type VoicePeriod = "week" | "m1" | "all";
export type VoiceSentiment = PersonaSentiment | "emergency";
export type VoiceSegment = Exclude<PersonaRelationship, "帰省者">;
export type VoiceSort = "list" | "topics";

export type VoiceFilter = {
  period: VoicePeriod;
  sents: VoiceSentiment[];
  segs: VoiceSegment[];
  topic: string | null;
  sort: VoiceSort;
};

export const DEFAULT_FILTER: VoiceFilter = {
  period: "m1",
  sents: [],
  segs: [],
  topic: null,
  sort: "list",
};

export const PERIOD_OPTIONS: { value: VoicePeriod; label: string }[] = [
  { value: "week", label: "今週" },
  { value: "m1", label: "直近30日" },
  { value: "all", label: "全期間" },
];

export const SENT_OPTIONS: { value: VoiceSentiment; label: string }[] = [
  { value: "positive", label: "ポジティブ" },
  { value: "negative", label: "ネガティブ" },
  { value: "emergency", label: "緊急" },
  { value: "request", label: "要望" },
];

export const SEG_OPTIONS: { value: VoiceSegment; label: string }[] = [
  { value: "村人", label: "🏠 村内住民" },
  { value: "観光客", label: "📷 観光客" },
  { value: "移住検討者", label: "🧳 移住検討" },
];

export const SORT_OPTIONS: { value: VoiceSort; label: string }[] = [
  { value: "list", label: "新しい順" },
  { value: "topics", label: "話題ごと" },
];

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
];

const sentLabel = (value: VoiceSentiment) =>
  SENT_OPTIONS.find((o) => o.value === value)?.label ?? value;

const segLabel = (value: VoiceSegment) =>
  SEG_OPTIONS.find((o) => o.value === value)?.label ?? value;

export const periodRange = (period: VoicePeriod, now: Date = new Date()) => {
  if (period === "all") {
    return {};
  }
  if (period === "week") {
    return { from: toDateString(startOfWeek(now)) };
  }
  const from = new Date(now);
  from.setDate(from.getDate() - 29);
  return { from: toDateString(from) };
};

export const toPersonaParams = (
  filter: VoiceFilter,
  now: Date = new Date(),
) => {
  const sentiments = filter.sents.filter(
    (s): s is PersonaSentiment => s !== "emergency",
  );
  return {
    ...periodRange(filter.period, now),
    ...(sentiments.length > 0 ? { sentiments } : {}),
    ...(filter.segs.length > 0 ? { relationships: filter.segs } : {}),
    ...(filter.topic ? { topic: filter.topic } : {}),
  };
};

export const shouldIncludePersonas = (filter: VoiceFilter) =>
  filter.sents.length === 0 || filter.sents.some((s) => s !== "emergency");

export const sentimentLabel = (value: string) =>
  value === "neutral"
    ? "中立"
    : (SENT_OPTIONS.find((o) => o.value === value)?.label ?? value);

export const shouldIncludeEmergencies = (filter: VoiceFilter) => {
  if (filter.segs.length > 0 || filter.topic) {
    return false;
  }
  return filter.sents.length === 0 || filter.sents.includes("emergency");
};

export const appliedCount = (filter: VoiceFilter) =>
  (filter.period !== DEFAULT_FILTER.period ? 1 : 0) +
  filter.sents.length +
  filter.segs.length +
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
  ...filter.segs.map((s) => ({ key: `seg:${s}`, label: segLabel(s) })),
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
  if (key.startsWith("seg:")) {
    const value = key.slice("seg:".length);
    return { ...filter, segs: filter.segs.filter((s) => s !== value) };
  }
  return filter;
};

type PersonaItem = {
  id: string;
  content: string;
  topic: string | null;
  sentiment: string | null;
  tags: string | null;
  demographicSummary: string | null;
  createdAt: string;
  conversationEndedAt: string | null;
};

type EmergencyItem = {
  id: string;
  type: string;
  description: string | null;
  location: string | null;
  reportedAt: string;
};

export type Voice =
  | {
      kind: "persona";
      id: string;
      date: string;
      content: string;
      topic: string | null;
      sentiment: string | null;
      attributes: string[];
    }
  | {
      kind: "emergency";
      id: string;
      date: string;
      content: string;
      location: string | null;
    };

const splitAttrs = (value: string | null) =>
  value
    ?.split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0) ?? [];

export const mergeVoices = (
  personas: PersonaItem[],
  emergencies: EmergencyItem[],
  options?: { period: VoicePeriod; now?: Date },
): Voice[] => {
  const from = options
    ? periodRange(options.period, options.now ?? new Date()).from
    : undefined;

  const personaVoices: Voice[] = personas.map((p) => ({
    kind: "persona",
    id: p.id,
    date: p.conversationEndedAt ?? p.createdAt,
    content: p.content,
    topic: p.topic,
    sentiment: p.sentiment,
    attributes: [...splitAttrs(p.demographicSummary), ...splitAttrs(p.tags)],
  }));

  const emergencyVoices: Voice[] = emergencies
    .filter((e) => !from || toDateString(new Date(e.reportedAt)) >= from)
    .map((e) => ({
      kind: "emergency",
      id: e.id,
      date: e.reportedAt,
      content: e.description ? `${e.type}：${e.description}` : e.type,
      location: e.location,
    }));

  return [...personaVoices, ...emergencyVoices].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
};

export type TopicGroup = {
  topic: string;
  count: number;
  sample: string;
  sentiments: Record<"positive" | "negative" | "request" | "neutral", number>;
};

export const groupVoicesByTopic = (voices: Voice[]): TopicGroup[] => {
  const groups = new Map<string, TopicGroup>();

  for (const voice of voices) {
    const topic =
      voice.kind === "emergency" ? "緊急" : (voice.topic ?? "その他");
    const group = groups.get(topic) ?? {
      topic,
      count: 0,
      sample: voice.content,
      sentiments: { positive: 0, negative: 0, request: 0, neutral: 0 },
    };
    group.count += 1;
    if (voice.kind === "persona" && voice.sentiment) {
      const sentiment = voice.sentiment as keyof TopicGroup["sentiments"];
      if (sentiment in group.sentiments) {
        group.sentiments[sentiment] += 1;
      }
    }
    groups.set(topic, group);
  }

  return [...groups.values()].sort((a, b) => b.count - a.count);
};

export const getSentimentStyle = (sentiment: string | null) => {
  if (!sentiment) return "";
  switch (sentiment) {
    case "positive":
      return "bg-green-50 text-green-700";
    case "negative":
      return "bg-red-50 text-red-700";
    case "request":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-stone-100 text-stone-600";
  }
};
