export const KIND_LABELS = {
  attribute: "話者の属性",
  topic: "話題",
  exclude: "集計対象外",
} as const;

export type TagGroupKind = keyof typeof KIND_LABELS;

export const KIND_ORDER: TagGroupKind[] = ["attribute", "topic", "exclude"];

export const groupLabel = (g: { axis: string | null; name: string }) =>
  g.axis ? `${g.axis} / ${g.name}` : g.name;
