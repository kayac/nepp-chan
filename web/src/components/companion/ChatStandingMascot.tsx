import { useThreadRuntime } from "@assistant-ui/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "~/lib/class-merge";
import { Mascot, type MascotExpression, type MascotState } from "./Mascot";

// 応答完了直後にランダムで選ぶ表情。talking 多めで、たまに笑顔・驚きが混じる
const POST_RESPONSE_STATES: readonly MascotState[] = [
  "talking",
  "talking",
  "talking",
  "success",
  "surprise",
];
const POST_RESPONSE_DURATION_MS = 3500;

const pickRandom = <T,>(arr: readonly T[]) =>
  arr[Math.floor(Math.random() * arr.length)];

const useMascotState = (): MascotState => {
  const runtime = useThreadRuntime();
  const [state, setState] = useState<MascotState>("idle");
  const wasRunningRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => {
      const isRunning = runtime.getState().isRunning;
      if (isRunning) {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        wasRunningRef.current = true;
        setState("thinking");
        return;
      }
      if (wasRunningRef.current) {
        wasRunningRef.current = false;
        setState(pickRandom(POST_RESPONSE_STATES));
        timerRef.current = window.setTimeout(() => {
          setState("idle");
          timerRef.current = null;
        }, POST_RESPONSE_DURATION_MS);
      }
    };
    sync();
    const unsub = runtime.subscribe(sync);
    return () => {
      unsub();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [runtime]);

  return state;
};

// thinking 時のみ全身寝姿（モックの ExprReactor 準拠）。それ以外は表情画像
const expressionOverride = (
  state: MascotState,
): MascotExpression | undefined =>
  state === "thinking" ? "sleeping" : undefined;

/**
 * 画面左下に固定配置するマスコット。Composer (中央配置) と被らないよう
 * 画面端寄りに張り付ける。lg 以上で表示。
 *
 * - idle (待機): expr-wave-smile
 * - thinking (応答中): pose-sleeping（全身寝姿）
 * - 応答完了直後 3.5 秒: ランダムで content / laugh / surprise → idle に戻る
 */
export const ChatStandingMascot = () => {
  const state = useMascotState();
  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[5] hidden lg:block",
        // Composer (max-w 672px / 中央配置) の左外側に寄せる。
        // 画面が狭い場合は左端 0 に張り付け。
        "left-[max(0px,calc(50%-520px))] bottom-2",
        "w-[170px] h-[220px]",
      )}
      style={{ animation: "mascot-float-sm 4.5s ease-in-out infinite" }}
      aria-hidden="true"
    >
      <Mascot
        state={state}
        expression={expressionOverride(state)}
        showHalo={false}
        floating={false}
        size={170}
        style={{
          width: "100%",
          height: "100%",
          filter: "drop-shadow(0 6px 14px rgba(15, 118, 110, 0.2))",
        }}
      />
    </div>
  );
};
