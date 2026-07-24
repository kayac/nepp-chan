import { Thread } from "@nepp-chan/shared";

export const Conversation = () => (
  <div
    style={{
      height: 560,
      display: "flex",
      flexDirection: "column",
      background: "var(--bg-app)",
      overflow: "hidden",
    }}
  >
    <Thread />
  </div>
);
