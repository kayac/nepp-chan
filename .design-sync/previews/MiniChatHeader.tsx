import { XMarkIcon } from "@heroicons/react/24/outline";
import { MiniChatHeader } from "@nepp-chan/shared";

const card: React.CSSProperties = {
  width: 360,
  background: "var(--bg-raised, #fff)",
  borderRadius: 16,
  padding: 16,
};

export const Default = () => (
  <div style={card}>
    <MiniChatHeader />
  </div>
);

export const WithAction = () => (
  <div style={card}>
    <MiniChatHeader
      action={
        <button
          type="button"
          aria-label="閉じる"
          style={{ marginLeft: "auto", display: "grid", placeItems: "center" }}
        >
          <XMarkIcon width={18} height={18} />
        </button>
      }
    />
  </div>
);
