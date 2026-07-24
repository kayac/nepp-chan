import { Landing } from "@nepp-chan/shared";

const screen: React.CSSProperties = {
  height: 880,
  zoom: 0.72,
  display: "flex",
  flexDirection: "column",
  background: "var(--bg-app)",
  overflow: "hidden",
};

export const Default = () => (
  <div style={screen}>
    <Landing onSubmit={() => {}} />
  </div>
);

export const Disabled = () => (
  <div style={screen}>
    <Landing onSubmit={() => {}} disabled />
  </div>
);
