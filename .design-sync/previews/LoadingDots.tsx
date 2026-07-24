import { LoadingDots } from "@nepp-chan/shared";

const row: React.CSSProperties = {
  display: "flex",
  gap: 32,
  alignItems: "center",
  padding: 24,
};

const item: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
};

const label: React.CSSProperties = {
  fontSize: 12,
  color: "var(--fg-3)",
};

export const Sizes = () => (
  <div style={row}>
    <div style={item}>
      <LoadingDots size="md" />
      <span style={label}>md（既定）</span>
    </div>
    <div style={item}>
      <LoadingDots size="sm" />
      <span style={label}>sm</span>
    </div>
  </div>
);

export const InSpeechBubble = () => (
  <div style={{ padding: 24, maxWidth: 420 }}>
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        background: "var(--bg-raised)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--r-xl)",
        padding: "14px 20px",
        boxShadow: "0 1px 3px rgba(28, 25, 23, 0.06)",
      }}
    >
      <LoadingDots />
      <span style={{ fontSize: 13, color: "var(--fg-3)" }}>
        ねっぷちゃんが返事を考えています
      </span>
    </div>
  </div>
);
