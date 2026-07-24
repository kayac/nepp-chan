import { ChatStandingMascot } from "@nepp-chan/shared";

export const Standing = () => (
  <div
    style={{
      position: "relative",
      height: 320,
      background: "var(--bg-app)",
      transform: "translateZ(0)",
      overflow: "hidden",
    }}
  >
    <ChatStandingMascot />
  </div>
);
