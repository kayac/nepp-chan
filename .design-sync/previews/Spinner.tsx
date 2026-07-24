import { Spinner } from "@nepp-chan/shared";

const row: React.CSSProperties = {
  display: "flex",
  gap: 40,
  alignItems: "flex-end",
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
      <Spinner size="sm" />
      <span style={label}>sm</span>
    </div>
    <div style={item}>
      <Spinner size="md" />
      <span style={label}>md（既定）</span>
    </div>
    <div style={item}>
      <Spinner size="lg" />
      <span style={label}>lg</span>
    </div>
  </div>
);

export const PageLoading = () => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
      padding: 40,
      background: "var(--bg-app)",
      borderRadius: "var(--r-xl)",
      border: "1px solid var(--border-1)",
      minWidth: 320,
    }}
  >
    <Spinner size="lg" />
    <span style={{ fontSize: 13, color: "var(--fg-2)" }}>
      音威子府村の最新情報を取得しています
    </span>
  </div>
);
