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

export const DEFAULT_COLORS = [
  "#ea580c",
  "#0284c7",
  "#16a34a",
  "#e11d48",
  "#ca8a04",
  "#0891b2",
  "#dc2626",
  "#2563eb",
];

export const OPEN_COLOR = "#5cb7bb";
export const CLOSED_COLOR = "#f4a06a";

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
  colors: readonly string[] = DEFAULT_COLORS,
): string => {
  const safe = colors.length > 0 ? colors : DEFAULT_COLORS;
  return safe[index % safe.length];
};

export const formatPiePercent = (percent: number | undefined): string =>
  `${((percent ?? 0) * 100).toFixed(0)}%`;
