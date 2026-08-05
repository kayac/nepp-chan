export const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #e7e5e4",
  borderRadius: "12px",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  padding: "8px 12px",
};

export const AXIS_STYLE = {
  stroke: "#a8a29e",
  fontSize: 12,
};

export const OPEN_COLOR = "#5cb7bb";
export const CLOSED_COLOR = "#f4a06a";

// 中立が件数の大半を占めるため、淡く穏やかな雪の青で「引かせる」配色にする
export const SENTIMENT_SERIES = [
  { key: "positive", label: "ポジティブ", color: "#5cb7bb" },
  { key: "negative", label: "ネガティブ", color: "#e76f7a" },
  { key: "request", label: "要望", color: "#f4b860" },
  { key: "neutral", label: "中立", color: "#c8d9e8" },
] as const;

export type SentimentKey = (typeof SENTIMENT_SERIES)[number]["key"];

export const NEPP_CHART_COLORS = [
  "#5cb7bb",
  "#f4a06a",
  "#8faf6f",
  "#89a8c0",
  "#e76f7a",
  "#f4b860",
  "#3f6e5a",
  "#78716c",
];

export const getColorAt = (
  index: number,
  colors: readonly string[] = NEPP_CHART_COLORS,
): string => {
  const safe = colors.length > 0 ? colors : NEPP_CHART_COLORS;
  return safe[index % safe.length];
};

export const formatPiePercent = (percent: number | undefined): string =>
  `${((percent ?? 0) * 100).toFixed(0)}%`;
