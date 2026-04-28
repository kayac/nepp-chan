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

type Presentation = {
  state: MascotState;
  expression?: MascotExpression;
};

// content part の最小限の型 (assistant-ui の ThreadMessageContentPart 簡易版)
type ContentPart = {
  type: string;
  result?: unknown;
  status?: { type?: string };
};

const hasRunningToolCall = (parts: readonly ContentPart[]): boolean =>
  parts.some(
    (p) =>
      p.type === "tool-call" &&
      (p.result === undefined || p.status?.type === "running"),
  );

const useMascotPresentation = (): Presentation => {
  const runtime = useThreadRuntime();
  const [pres, setPres] = useState<Presentation>({ state: "idle" });
  const wasRunningRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // 同値の setPres を避けて不要な再レンダーを抑える
    const setPresIfChanged = (next: Presentation) => {
      setPres((prev) =>
        prev.state === next.state && prev.expression === next.expression
          ? prev
          : next,
      );
    };

    const sync = () => {
      const t = runtime.getState();
      const isRunning = t.isRunning;

      if (isRunning) {
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        wasRunningRef.current = true;
        const last = t.messages[t.messages.length - 1];
        const parts = (last?.content ?? []) as readonly ContentPart[];
        // ツール実行中は指差しポーズ、それ以外は寝姿
        const expression: MascotExpression = hasRunningToolCall(parts)
          ? "point"
          : "sleeping";
        setPresIfChanged({ state: "thinking", expression });
        return;
      }

      if (wasRunningRef.current) {
        wasRunningRef.current = false;
        setPresIfChanged({ state: pickRandom(POST_RESPONSE_STATES) });
        timerRef.current = window.setTimeout(() => {
          setPresIfChanged({ state: "idle" });
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

  return pres;
};

/**
 * 画面左下に固定配置するマスコット。Composer (中央配置) と被らないよう
 * 画面端寄りに張り付ける。lg 以上で表示。
 *
 * - idle (待機): expr-wave-smile
 * - thinking + ツール実行中: pose-point（指差し案内 = 調べてる）
 * - thinking + テキスト生成のみ: pose-sleeping
 * - 応答完了直後 3.5 秒: ランダムで content / laugh / surprise → idle に戻る
 */
export const ChatStandingMascot = () => {
  const { state, expression } = useMascotPresentation();
  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[5] hidden lg:block",
        // Composer (max-w 672px / 中央配置) の左外側に寄せる。
        // 画面が狭い場合は左端 0 に張り付け。
        "left-[max(0px,calc(50%-520px))] bottom-2",
        "w-[170px] h-[220px]",
      )}
      style={{
        animation: "mascot-float-sm 4.5s ease-in-out infinite",
        willChange: "transform",
      }}
      aria-hidden="true"
    >
      <Mascot
        state={state}
        expression={expression}
        showHalo={false}
        floating={false}
        style={{
          width: "100%",
          height: "100%",
          filter: "drop-shadow(0 6px 14px rgba(15, 118, 110, 0.2))",
        }}
      />
    </div>
  );
};
