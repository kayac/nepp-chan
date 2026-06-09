import {
  Mascot,
  type MascotExpression,
  type MascotState,
} from "@nepp-chan/shared/components/Mascot";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import type { UIMessage } from "ai";
import { isToolOrDynamicToolUIPart } from "ai";
import { useEffect, useRef, useState } from "react";

import { useChatContext } from "~/app/chat/contexts/ChatContext";

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

const hasRunningToolCall = (parts: UIMessage["parts"]): boolean =>
  parts.some(
    (p) =>
      isToolOrDynamicToolUIPart(p) &&
      p.state !== "output-available" &&
      p.state !== "output-error",
  );

const useMascotPresentation = (): Presentation => {
  const { messages, isRunning } = useChatContext();
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

    if (isRunning) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      wasRunningRef.current = true;
      const last = messages[messages.length - 1];
      const parts = last?.parts ?? [];
      const expression: MascotExpression = hasRunningToolCall(parts)
        ? "thinking"
        : "content";
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
  }, [messages, isRunning]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  return pres;
};

/**
 * 画面左下に固定配置するマスコット。
 *
 * 表情:
 * - idle (待機): expr-wave-smile
 * - thinking + ツール実行中: pose-thinking
 * - thinking + テキスト生成のみ: expr-content
 * - 応答完了直後 3.5 秒: ランダムで content / laugh / surprise → idle に戻る
 */
export const ChatStandingMascot = () => {
  const { state, expression } = useMascotPresentation();
  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[5]",
        "-right-[3px] bottom-[calc(72px+env(safe-area-inset-bottom))] w-28 h-28",
        "lg:left-[max(0px,calc(50%-520px))] lg:bottom-2 lg:w-[170px] lg:h-[220px]",
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
          filter: "drop-shadow(0 6px 14px rgba(15, 113, 119, 0.2))",
        }}
      />
    </div>
  );
};
