import { useChat } from "@ai-sdk/react";
import { ChatMarkdown } from "@nepp-chan/shared/components/ChatMarkdown";
import {
  INITIAL_MESSAGE,
  SAMPLE_QUESTIONS,
  SIMPLE_CHAT_MAX_MESSAGES,
} from "@nepp-chan/shared/constants/simple-chat";
import { useChatAutoScroll } from "@nepp-chan/shared/hooks/useChatAutoScroll";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { messageText } from "@nepp-chan/shared/lib/message-text";
import { createSimpleChatTransport } from "@nepp-chan/shared/lib/simple-chat-transport";
import { SendIcon, XIcon } from "lucide-react";
import { type SubmitEvent, useEffect, useMemo, useRef, useState } from "react";
import { CLOSE_MESSAGE_TYPE } from "./messages";

type Props = {
  apiUrl: string;
  webUrl: string;
  iconSrc?: string;
};

const closeWidget = () => {
  window.parent.postMessage({ type: CLOSE_MESSAGE_TYPE }, "*");
};

export const WidgetChat = ({
  apiUrl,
  webUrl,
  iconSrc = "/mascot/icon.png",
}: Props) => {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const streamRef = useRef<HTMLDivElement | null>(null);

  const transport = useMemo(
    () =>
      createSimpleChatTransport({
        apiUrl,
        historyLimit: SIMPLE_CHAT_MAX_MESSAGES,
      }),
    [apiUrl],
  );

  const { messages, sendMessage, status, error } = useChat({
    messages: [INITIAL_MESSAGE],
    transport,
    experimental_throttle: 50,
  });

  const isBusy = status === "submitted" || status === "streaming";

  useChatAutoScroll(streamRef);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) closeWidget();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const ask = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || isBusy) return;
    sendMessage({ text: trimmed });
    setInput("");
    setShowSuggestions(false);
  };

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden rounded-[20px] bg-white">
      <div className="flex items-center gap-3 border-b border-(--paper-200) px-4 py-3">
        <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-(--teal-50)">
          <img src={iconSrc} alt="" className="size-[34px] object-contain" />
        </span>
        <div className="flex flex-col">
          <span className="font-(family-name:--font-display) text-sm font-bold text-(--snow-800)">
            ねっぷちゃん
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-(--fg-3)">
            <span className="size-1.5 rounded-full bg-(--success)" />
            オンライン
          </span>
        </div>
        <button
          type="button"
          onClick={closeWidget}
          aria-label="チャットを閉じる"
          className="ml-auto grid size-8 place-items-center rounded-full text-(--fg-3) transition-colors hover:bg-(--paper-100) hover:text-(--fg-1)"
        >
          <XIcon className="size-[18px]" aria-hidden="true" />
        </button>
      </div>

      <div
        ref={streamRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4"
      >
        {messages.map((m) => {
          const text = messageText(m);
          if (!text) return null;
          return (
            <div
              key={m.id}
              className={cn(
                "w-fit max-w-[85%] break-words rounded-(--r-bubble) px-[18px] py-3 text-sm leading-[1.7]",
                "animate-[lp-bubble-in_400ms_cubic-bezier(0.22,1,0.36,1)] shadow-(--shadow-float-sm)",
                m.role === "user"
                  ? "self-end bg-(--brand-hover) text-white"
                  : "self-start bg-(--paper-50) text-(--fg-1)",
              )}
            >
              <ChatMarkdown
                text={text}
                variant={m.role === "user" ? "user" : "assistant"}
              />
            </div>
          );
        })}
        {status === "submitted" && (
          <div className="flex w-fit max-w-[85%] items-center gap-2 self-start rounded-(--r-bubble) bg-(--paper-50) px-[18px] py-3">
            <span className="size-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-xs font-medium text-(--fg-2)">
              ちょっと待ってね…
            </span>
          </div>
        )}
        {error && (
          <div className="w-fit max-w-[85%] self-start rounded-(--r-bubble) bg-red-50 px-[18px] py-3 text-sm text-red-700">
            通信エラーが発生したよ。もう一度試してみてね。
          </div>
        )}
      </div>

      {showSuggestions && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              disabled={isBusy}
              className={cn(
                "rounded-(--r-pill) border border-(--paper-200) bg-white px-3 py-1.5 text-xs text-(--fg-2)",
                "transition-colors duration-150",
                "hover:border-(--teal-300) hover:bg-(--teal-50) hover:text-(--brand)",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={cn(
          "mx-4 flex items-center gap-2 rounded-(--r-pill)",
          "border border-(--paper-200) bg-(--paper-50) px-3 py-2",
          "transition-shadow duration-200 focus-within:border-(--teal-400) focus-within:shadow-(--ring-brand)",
        )}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ねっぷちゃんに話しかける…"
          className="flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-(--fg-4)"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          aria-label="送信"
          className={cn(
            "grid size-8 place-items-center rounded-full bg-(--teal-700) text-white",
            "transition-colors hover:bg-(--teal-800)",
            "disabled:cursor-not-allowed disabled:opacity-55",
          )}
        >
          <SendIcon className="size-[18px]" aria-hidden="true" />
        </button>
      </form>

      <div className="px-4 pb-3 pt-2 text-center">
        <a
          href={webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-(--fg-4) underline underline-offset-2 hover:text-(--fg-3)"
        >
          つづきは Web チャットで
        </a>
      </div>
    </div>
  );
};
