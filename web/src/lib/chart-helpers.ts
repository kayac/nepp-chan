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
  "#ea580c", // orange-600
  "#0284c7", // sky-600
  "#16a34a", // green-600
  "#e11d48", // rose-600
  "#ca8a04", // yellow-600
  "#0891b2", // cyan-600
  "#dc2626", // red-600
  "#2563eb", // blue-600
];

export const NEPP_CHART_COLORS = [
  "#5cb7bb", // teal-500
  "#f4a06a", // apricot-500
  "#8faf6f", // moss-500
  "#89a8c0", // sky-500
  "#e76f7a", // berry
  "#f4b860", // honey
  "#3f6e5a", // pine
  "#78716c", // snow-500
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
