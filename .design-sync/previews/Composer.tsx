import { Composer } from "@nepp-chan/shared";

export const Default = () => (
  <div
    style={{
      maxWidth: 640,
      margin: "0 auto",
      padding: "32px 16px",
      background: "var(--bg-app)",
    }}
  >
    <Composer />
  </div>
);
