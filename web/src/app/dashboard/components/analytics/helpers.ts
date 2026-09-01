const DAY_MS = 24 * 60 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const toJstDate = (d: Date) =>
  new Date(d.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);

/** 直近 days 日の JST 日付範囲（from は days-1 日前、to は今日。両端を含む） */
export const jstDateRange = (days: number, now: Date = new Date()) => ({
  from: toJstDate(new Date(now.getTime() - (days - 1) * DAY_MS)),
  to: toJstDate(now),
});

type DailyUsageRow = {
  date: string;
  model: string;
  totalTokens: number;
  costUsd: number;
};

export const pivotDailyUsage = <T extends DailyUsageRow>(daily: T[]) => {
  const models = [...new Set(daily.map((d) => d.model))];
  const dates = [...new Set(daily.map((d) => d.date))];

  const rows = dates.map((date) => ({
    date,
    ...Object.fromEntries(
      daily.filter((d) => d.date === date).map((d) => [d.model, d.totalTokens]),
    ),
  }));

  return { models, rows };
};

export const groupUsageByDate = <T extends DailyUsageRow>(daily: T[]) => {
  const dates = [...new Set(daily.map((d) => d.date))];

  return dates
    .map((date) => {
      const models = daily.filter((d) => d.date === date);
      return {
        date,
        models,
        totalTokens: models.reduce((sum, m) => sum + m.totalTokens, 0),
        costUsd: models.reduce((sum, m) => sum + m.costUsd, 0),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
};

// 表示用の目安レート。請求は USD で確定し、円表示は直感的な把握のための概算
export const USD_JPY_RATE = 150;

const jpyFormat = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 2,
});

export const formatCostJpy = (usd: number) =>
  `¥${jpyFormat.format(usd * USD_JPY_RATE)}`;

const jstTimeFormat = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatJstTime = (iso: string) =>
  jstTimeFormat.format(new Date(iso));

export const formatDurationSeconds = (seconds: number | null) => {
  if (seconds === null) return "-";
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分${seconds % 60}秒`;
  return `${Math.floor(minutes / 60)}時間${minutes % 60}分`;
};

const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  widget: "ウィジェット",
  line: "LINE",
  voice: "電話",
  lp: "LP",
};

export const platformLabel = (platform: string | null) =>
  platform === null ? "不明" : (PLATFORM_LABELS[platform] ?? platform);

const AGENT_LABELS: Record<string, string> = {
  "nepp-chan": "本体",
  knowledge: "ナレッジ検索",
  "web-researcher": "Web検索",
  "voice-summarizer": "音声要約",
  "intent-router": "意図分類",
  emergency: "緊急対応",
  "emergency-reporter": "緊急報告",
  feedback: "フィードバック",
  "persona-analyst": "声分析",
  persona: "ペルソナ抽出",
  converter: "画像変換",
  "weekly-report": "週次レポート",
  "knowledge-reranker": "リランク",
  embedding: "埋め込み",
};

export const agentLabel = (agent: string | null) =>
  agent === null ? "記録前" : (AGENT_LABELS[agent] ?? agent);

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  google: "Google",
  other: "その他",
};

export const providerLabel = (provider: string) =>
  PROVIDER_LABELS[provider] ?? provider;

// エージェント別コストの色。全体と会話内で同じエージェントが同じ色になるよう名前で固定する
const AGENT_COLORS: Record<string, string> = {
  "knowledge-reranker": "var(--berry)",
  knowledge: "var(--admin-light)",
  "nepp-chan": "var(--brand)",
  "web-researcher": "var(--sky-500)",
  "intent-router": "var(--moss-500)",
  embedding: "var(--fg-4)",
};

const FALLBACK_AGENT_COLOR = "var(--border-2)";

export const agentColor = (agent: string | null) =>
  (agent && AGENT_COLORS[agent]) || FALLBACK_AGENT_COLOR;

export const cacheRatePercent = (params: {
  inputTokens: number;
  cachedInputTokens: number;
}) =>
  params.inputTokens > 0
    ? Math.round((params.cachedInputTokens / params.inputTokens) * 100)
    : 0;
