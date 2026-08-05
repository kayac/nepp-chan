export const SENTIMENT_LABELS: Record<string, string> = {
  positive: "ポジティブ",
  negative: "ネガティブ",
  request: "要望",
  neutral: "中立",
};

export const sentimentLabel = (value: string) =>
  SENTIMENT_LABELS[value] ?? value;

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

export type PersonaItem = {
  id: string;
  content: string;
  topic: string | null;
  sentiment: string | null;
  tags: string | null;
  demographicSummary: string | null;
  createdAt: string;
  conversationEndedAt: string | null;
};

export type EmergencyItem = {
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

// 会話終了時刻が基準。createdAt は抽出バッチの実行時刻のためフォールバックにのみ使う
export const personaDate = (p: {
  createdAt: string;
  conversationEndedAt: string | null;
}) => p.conversationEndedAt ?? p.createdAt;

const splitAttrs = (value: string | null) =>
  value
    ?.split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0) ?? [];

export const mergeVoices = (
  personas: PersonaItem[],
  emergencies: EmergencyItem[],
): Voice[] => {
  const personaVoices: Voice[] = personas.map((p) => ({
    kind: "persona",
    id: p.id,
    date: personaDate(p),
    content: p.content,
    topic: p.topic,
    sentiment: p.sentiment,
    attributes: [...splitAttrs(p.demographicSummary), ...splitAttrs(p.tags)],
  }));

  const emergencyVoices: Voice[] = emergencies.map((e) => ({
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
