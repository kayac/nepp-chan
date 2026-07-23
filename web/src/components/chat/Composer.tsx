import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import { StopIcon } from "@heroicons/react/24/solid";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { useState } from "react";

import { useChatContext } from "~/app/chat/contexts/ChatContext";

const isTouchDevice = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

export const Composer = () => {
  const { sendMessage, isRunning, stop } = useChatContext();
  const [input, setInput] = useState("");

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    sendMessage({ text });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // タッチデバイスでは Enter で改行、送信ボタンで送信
    if (isTouchDevice()) return;
    if (e.key !== "Enter" || e.shiftKey) return;
    // IME 変換中の Enter は送信せず、変換確定として扱う
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    submit();
  };

  return (
    <form
      className={cn(
        "aui-composer-root pointer-events-auto",
        "relative flex w-full items-center gap-2",
        "rounded-(--r-footer) border-2 border-(--teal-500) bg-(--paper-0)",
        "px-5 py-2.5",
      )}
      style={{ boxShadow: "var(--shadow-floating-input)" }}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="ねっぷちゃんに話しかける…"
        className={cn(
          "aui-composer-input flex-1 resize-none border-0 bg-transparent outline-none",
          "px-1 py-2 text-base text-(--fg-1) placeholder:text-(--fg-4) leading-snug",
          "min-h-[24px] max-h-32",
        )}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          if (isTouchDevice()) {
            setTimeout(() => {
              e.target.scrollIntoView({ behavior: "smooth", block: "end" });
            }, 300);
          }
        }}
        rows={1}
        // biome-ignore lint/a11y/noAutofocus: チャット入力は即時入力できることが UX 上重要
        autoFocus
        aria-label="メッセージ入力"
      />
      <ComposerAction
        isRunning={isRunning}
        canSend={input.trim().length > 0}
        onStop={stop}
      />
    </form>
  );
};

type ComposerActionProps = {
  isRunning: boolean;
  canSend: boolean;
  onStop: () => void;
};

const ComposerAction = ({
  isRunning,
  canSend,
  onStop,
}: ComposerActionProps) => (
  <div className="aui-composer-action-wrapper flex items-center flex-none">
    {isRunning ? (
      <button
        type="button"
        aria-label="停止"
        onClick={onStop}
        className={cn(
          "aui-composer-cancel size-10 rounded-full grid place-items-center",
          "bg-(--paper-100) text-(--fg-2) transition-colors hover:bg-(--paper-200)",
        )}
      >
        <StopIcon className="aui-composer-cancel-icon size-3" />
      </button>
    ) : (
      <button
        type="submit"
        aria-label="送信"
        disabled={!canSend}
        className={cn(
          "aui-composer-send size-10 rounded-full grid place-items-center",
          "bg-(--teal-700) text-(--paper-0)",
          "transition-colors hover:bg-(--teal-800)",
          "disabled:bg-(--paper-100) disabled:text-(--fg-4)",
        )}
        style={{ boxShadow: "0 4px 12px rgba(15, 118, 110, 0.35)" }}
      >
        <PaperAirplaneIcon className="aui-composer-send-icon size-4" />
      </button>
    )}
  </div>
);
