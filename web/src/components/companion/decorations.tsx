import type { CSSProperties } from "react";

type CommonProps = {
  size?: number;
  color?: string;
  opacity?: number;
  className?: string;
  style?: CSSProperties;
};

export const Snowflake = ({
  size = 24,
  color = "var(--teal-500)",
  opacity = 1,
  className,
  style,
}: CommonProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={{ opacity, ...style }}
    aria-hidden="true"
  >
    <g stroke={color} strokeWidth="1.6" strokeLinecap="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
      <path d="M9 3.5 L12 6 L15 3.5" />
      <path d="M9 20.5 L12 18 L15 20.5" />
      <path d="M3.5 9 L6 12 L3.5 15" />
      <path d="M20.5 9 L18 12 L20.5 15" />
    </g>
  </svg>
);

export const Sparkle = ({
  size = 20,
  color = "var(--apricot-500)",
  className,
  style,
}: CommonProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    className={className}
    style={style}
    aria-hidden="true"
  >
    <path d="M12 0 L13.5 10.5 L24 12 L13.5 13.5 L12 24 L10.5 13.5 L0 12 L10.5 10.5 Z" />
  </svg>
);

export const Pine = ({
  size = 32,
  color = "var(--moss-500)",
  opacity = 0.55,
  className,
  style,
}: CommonProps) => (
  <svg
    width={size}
    height={size * 1.4}
    viewBox="0 0 24 34"
    fill={color}
    className={className}
    style={{ opacity, ...style }}
    aria-hidden="true"
  >
    <path d="M12 2 L17 10 L14 10 L19 17 L15 17 L21 25 L13 25 L13 32 L11 32 L11 25 L3 25 L9 17 L5 17 L10 10 L7 10 Z" />
  </svg>
);

type BirchProps = {
  height?: number;
  color?: string;
  markColor?: string;
  leafColor?: string;
  opacity?: number;
  style?: CSSProperties;
  seed?: number;
};

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
