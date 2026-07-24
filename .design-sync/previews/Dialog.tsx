import { Button, Dialog } from "@nepp-chan/shared";

const card: React.CSSProperties = {
  width: 380,
  background: "var(--bg-raised, #fff)",
  borderRadius: 16,
  padding: 24,
  boxShadow: "0 20px 40px rgb(0 0 0 / 0.2)",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 17,
  fontWeight: 700,
  color: "var(--fg-1)",
};

const body: React.CSSProperties = {
  margin: "10px 0 20px",
  fontSize: 14,
  lineHeight: 1.7,
  color: "var(--fg-2)",
};

const row: React.CSSProperties = {
  display: "flex",
  gap: 12,
};

const grow: React.CSSProperties = { flex: 1 };

export const DeleteThreadConfirm = () => (
  <Dialog onClose={() => {}}>
    <div style={card}>
      <h2 style={title}>スレッドを削除しますか？</h2>
      <p style={body}>
        「音威子府そばのお店について」の会話履歴が削除されます。この操作は取り消せません。
      </p>
      <div style={row}>
        <Button variant="outline" style={grow}>
          キャンセル
        </Button>
        <Button variant="destructive" style={grow}>
          削除する
        </Button>
      </div>
    </div>
  </Dialog>
);
