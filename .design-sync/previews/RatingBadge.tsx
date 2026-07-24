import { RatingBadge } from "@nepp-chan/shared";

const row: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  padding: 16,
};

export const Variants = () => (
  <div style={row}>
    <RatingBadge rating="good" />
    <RatingBadge rating="idea" />
    <RatingBadge rating="bad" />
  </div>
);
