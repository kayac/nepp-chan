import { LoadingText } from "@nepp-chan/shared";

const column: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  padding: 24,
};

export const Default = () => (
  <div style={column}>
    <LoadingText />
  </div>
);

export const CustomMessages = () => (
  <div style={column}>
    <LoadingText>音威子府そばのお店を検索中</LoadingText>
    <LoadingText>おといねっぷ美術工芸高校の情報を調べています</LoadingText>
    <LoadingText>クマの出没情報を確認中</LoadingText>
  </div>
);

export const InPanel = () => (
  <div style={{ padding: 24 }}>
    <div
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--border-1)",
        borderRadius: "var(--r-lg)",
        padding: "16px 20px",
        maxWidth: 360,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: "var(--fg-1)",
          marginBottom: 8,
        }}
      >
        村内イベントカレンダー
      </div>
      <LoadingText>今月の予定を読み込み中</LoadingText>
    </div>
  </div>
);
