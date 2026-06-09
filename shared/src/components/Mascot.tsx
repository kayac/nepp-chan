import { cn } from "@nepp-chan/shared/lib/class-merge";
import type { CSSProperties } from "react";

const MASCOT_ASSETS = {
  // 表情（頭・胸あたり）
  zzz: "/mascot/expr-zzz.png",
  startled: "/mascot/expr-startled.png",
  "wave-smile": "/mascot/expr-wave-smile.png",
  surprise: "/mascot/expr-surprise.png",
  pout: "/mascot/expr-pout.png",
  laugh: "/mascot/expr-laugh.png",
  content: "/mascot/expr-content.png",
  shy: "/mascot/expr-shy.png",
  // ポーズ（全身）
  "nap-curled": "/mascot/pose-nap-curled.png",
  wave: "/mascot/pose-wave.png",
  point: "/mascot/pose-point.png",
  banzai: "/mascot/pose-banzai.png",
  seated: "/mascot/pose-seated.png",
  sleeping: "/mascot/pose-sleeping.png",
  stretch: "/mascot/pose-stretch.png",
  "shy-stand": "/mascot/pose-shy-stand.png",
  // フルボディ
  normal: "/mascot/pose-normal.png",
  thinking: "/mascot/pose-thinking.png",
} as const;

export type MascotExpression = keyof typeof MASCOT_ASSETS;

export type MascotState =
  | "idle"
  | "thinking"
  | "talking"
  | "success"
  | "alert"
  | "surprise"
  | "error"
  | "quiet"
  | "sleep"
  | "greet"
  | "cheer"
  | "guide"
  | "stretch";

const STATE_MAP: Record<MascotState, MascotExpression> = {
  idle: "wave-smile",
  thinking: "zzz",
  talking: "content",
  success: "laugh",
  alert: "startled",
  surprise: "surprise",
  error: "pout",
  quiet: "shy",
  sleep: "sleeping",
  greet: "wave",
  cheer: "banzai",
  guide: "point",
  stretch: "stretch",
};

type Props = {
  state?: MascotState;
  expression?: MascotExpression;
  size?: number;
  floating?: boolean;
  haloColor?: string;
  showHalo?: boolean;
  className?: string;
  style?: CSSProperties;
  alt?: string;
};

export const Mascot = ({
  state = "idle",
  expression,
  size = 200,
  floating = true,
  haloColor = "var(--teal-300)",
  showHalo = true,
  className,
  style,
  alt = "ねっぷちゃん",
}: Props) => {
  const key: MascotExpression = expression ?? STATE_MAP[state];
  const src = MASCOT_ASSETS[key];

  return (
    <div
      className={cn("relative inline-block", className)}
      style={{ width: size, height: size, ...style }}
    >
      {showHalo && (
        <span
          aria-hidden="true"
          className="absolute left-1/2 bottom-0 w-[85%] h-[22%] rounded-full opacity-25 blur-xl pointer-events-none"
          style={{
            transform: "translateX(-50%)",
            background: haloColor,
          }}
        />
      )}
      <img
        className={cn(
          "relative w-full h-full object-contain select-none pointer-events-none",
          floating && "animate-[mascot-float_4.5s_ease-in-out_infinite]",
        )}
        style={{
          filter:
            "drop-shadow(0 18px 30px rgba(28, 25, 23, 0.12)) drop-shadow(0 6px 12px rgba(28, 25, 23, 0.08))",
        }}
        src={src}
        alt={alt}
        decoding="async"
        draggable={false}
      />
    </div>
  );
};

// 切替頻度の高い表情・ポーズはロード時にプリロードしてチラつきを防ぐ
const PRELOAD_KEYS: readonly MascotExpression[] = [
  "wave-smile",
  "content",
  "laugh",
  "surprise",
  "thinking",
];

if (typeof window !== "undefined") {
  for (const key of PRELOAD_KEYS) {
    const img = new Image();
    img.src = MASCOT_ASSETS[key];
  }
}
