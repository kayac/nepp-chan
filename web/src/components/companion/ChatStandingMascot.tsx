import { useThreadRuntime } from "@assistant-ui/react";
import { useEffect, useState } from "react";
import { cn } from "~/lib/class-merge";
import { Mascot } from "./Mascot";

const useIsThreadRunning = () => {
  const runtime = useThreadRuntime();
  const [isRunning, setIsRunning] = useState(false);
  useEffect(() => {
    const update = () => setIsRunning(runtime.getState().isRunning);
    update();
    return runtime.subscribe(update);
  }, [runtime]);
  return isRunning;
};

/**
 * Composer の左下に張り付くマスコット。
 * AI が応答中は寝顔ポーズ、待機中は立ちポーズに切り替わる。
 * モバイル幅では非表示。
 */
export const ChatStandingMascot = () => {
  const isRunning = useIsThreadRunning();
  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[5] hidden md:block",
        "transition-[width,height,bottom,left] duration-400",
        isRunning
          ? "left-[calc(50%-320px-50px)] bottom-12 w-52 h-[304px]"
          : "left-[calc(50%-320px-60px)] bottom-14 w-60 h-80",
      )}
      style={{ animation: "mascot-float-sm 4.5s ease-in-out infinite" }}
      aria-hidden="true"
    >
      <Mascot
        state={isRunning ? "thinking" : "idle"}
        showHalo={false}
        floating={false}
        size={isRunning ? 208 : 240}
        style={{
          width: "100%",
          height: "100%",
          filter: "drop-shadow(0 6px 14px rgba(15, 118, 110, 0.2))",
        }}
      />
    </div>
  );
};
