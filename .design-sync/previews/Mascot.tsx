import { Mascot } from "@nepp-chan/shared";

const grid: React.CSSProperties = {
  display: "flex",
  gap: 20,
  flexWrap: "wrap",
  alignItems: "flex-end",
  padding: 16,
};

const cell: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "var(--fg-3)",
};

const states = [
  "idle",
  "thinking",
  "talking",
  "success",
  "error",
  "greet",
  "cheer",
  "guide",
] as const;

export const States = () => (
  <div style={grid}>
    {states.map((state) => (
      <div key={state} style={cell}>
        <Mascot state={state} size={96} />
        <span>{state}</span>
      </div>
    ))}
  </div>
);

export const Sizes = () => (
  <div style={grid}>
    <Mascot state="idle" size={64} />
    <Mascot state="idle" size={112} />
    <Mascot state="idle" size={160} />
  </div>
);

export const WithHalo = () => (
  <div style={grid}>
    <div style={cell}>
      <Mascot state="greet" size={120} showHalo />
      <span>ハロー演出あり</span>
    </div>
    <div style={cell}>
      <Mascot state="sleep" size={120} showHalo haloColor="var(--sky-100)" />
      <span>ハロー色カスタム</span>
    </div>
  </div>
);

export const Floating = () => (
  <div style={{ ...grid, minHeight: 180 }}>
    <Mascot state="idle" size={120} floating />
  </div>
);
