import type { CSSProperties } from "react";

type BirchProps = {
  height?: number;
  color?: string;
  markColor?: string;
  leafColor?: string;
  opacity?: number;
  style?: CSSProperties;
  seed?: number;
};

/**
 * 白樺の木 (背景レイヤー用)。seed で樹皮マークの位置を決定的に生成。
 */
export const Birch = ({
  height = 120,
  color = "var(--paper-0)",
  markColor = "#2a2a2a",
  leafColor = "var(--moss-500)",
  opacity = 1,
  style,
  seed = 1,
}: BirchProps) => {
  const width = height * 0.18;
  const marks: { y: number; w: number; xOffset: number; tilt: number }[] = [];
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const markCount = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < markCount; i++) {
    const y = 12 + rand() * 70;
    const w = 30 + rand() * 40;
    const xOffset = rand() * (100 - w);
    const tilt = (rand() - 0.5) * 8;
    marks.push({ y, w, xOffset, tilt });
  }
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 560"
      preserveAspectRatio="none"
      style={{ opacity, overflow: "visible", ...style }}
      aria-hidden="true"
    >
      <g fill={leafColor} opacity="0.85">
        <ellipse cx="50" cy="28" rx="46" ry="30" />
        <ellipse cx="28" cy="48" rx="30" ry="22" />
        <ellipse cx="72" cy="50" rx="32" ry="24" />
        <ellipse cx="50" cy="70" rx="26" ry="18" />
      </g>
      <rect x="44" y="60" width="12" height="500" fill={color} />
      <rect x="52" y="60" width="4" height="500" fill="#000" opacity="0.08" />
      <g fill={markColor}>
        {marks.map((m, i) => {
          const yPx = 60 + (m.y / 100) * 500;
          const xPx = 44 + (m.xOffset / 100) * 12;
          const wPx = (m.w / 100) * 12;
          return (
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: deterministic mark list
              key={i}
              x={xPx}
              y={yPx}
              width={wPx}
              height={3}
              transform={`rotate(${m.tilt} ${xPx + wPx / 2} ${yPx + 1.5})`}
              rx="1"
            />
          );
        })}
      </g>
    </svg>
  );
};
