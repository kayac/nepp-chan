import { ModalHeader } from "@nepp-chan/shared";

const card: React.CSSProperties = {
  width: 420,
  background: "var(--bg-raised, #fff)",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 20px 40px rgb(0 0 0 / 0.15)",
};

export const TitleOnly = () => (
  <div style={card}>
    <ModalHeader title="投票結果" onClose={() => {}} />
  </div>
);

export const WithDescription = () => (
  <div style={card}>
    <ModalHeader
      title="新規作成"
      description="何を聞きますか？"
      onClose={() => {}}
    />
  </div>
);
