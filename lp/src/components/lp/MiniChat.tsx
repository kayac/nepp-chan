import { useChat } from "@ai-sdk/react";
import { ChatMarkdown } from "@nepp-chan/shared/components/ChatMarkdown";
import {
  INITIAL_MESSAGE,
  SAMPLE_QUESTIONS,
} from "@nepp-chan/shared/constants/simple-chat";
import { useChatAutoScroll } from "@nepp-chan/shared/hooks/useChatAutoScroll";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { messageText } from "@nepp-chan/shared/lib/message-text";
import { createSimpleChatTransport } from "@nepp-chan/shared/lib/simple-chat-transport";
import { ArrowRightIcon, EllipsisIcon, SendIcon } from "lucide-react";
import { type SubmitEvent, useMemo, useRef, useState } from "react";

type Props = {
  apiUrl: string;
  webUrl: string;
  iconSrc?: string;
};

export const MiniChat = ({
  apiUrl,
  webUrl,
  iconSrc = "/mascot/icon.png",
}: Props) => {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const streamRef = useRef<HTMLDivElement | null>(null);

  const transport = useMemo(
    () => createSimpleChatTransport({ apiUrl, historyLimit: 1 }),
    [apiUrl],
  );

  const { messages, sendMessage, status, error } = useChat({
    messages: [INITIAL_MESSAGE],
    transport,
    experimental_throttle: 50,
  });

  const isBusy = status === "submitted" || status === "streaming";
  const hasCompletedExchange =
    status === "ready" && messages.some((m) => m.role === "user");

  useChatAutoScroll(streamRef);

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
    <div className="flex flex-col rounded-[28px] border border-(--paper-200) bg-white p-5 shadow-(--shadow-float-md)">
      <div className="flex items-center gap-3 border-b border-(--paper-200) pb-3">
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
        <EllipsisIcon
          className="ml-auto size-3.5 text-(--fg-4)"
          aria-hidden="true"
        />
      </div>

      <div
        ref={streamRef}
        className="flex max-h-[280px] flex-col gap-2 overflow-y-auto py-4"
      >
        {messages.map((m) => {
          const text = messageText(m);
          if (!text) return null;
          return (
            <div
              key={m.id}
              className={cn(
                "w-fit max-w-[78%] break-words rounded-(--r-bubble) px-[18px] py-3 text-sm leading-[1.7]",
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
        {isBusy && (
          <div className="flex w-fit max-w-[78%] items-center gap-2 self-start rounded-(--r-bubble) bg-(--paper-50) px-[18px] py-3">
            <span className="size-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-xs font-medium text-(--fg-2)">
              ちょっと待ってね…
            </span>
          </div>
        )}
        {error && (
          <div className="w-fit max-w-[78%] self-start rounded-(--r-bubble) bg-red-50 px-[18px] py-3 text-sm text-red-700">
            通信エラーが発生したよ。もう一度試してみてね。
          </div>
        )}
      </div>

      {showSuggestions && (
        <div className="mt-1 flex flex-wrap gap-1.5">
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

      {hasCompletedExchange ? (
        <a
          href={webUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "mt-3 flex items-center justify-center gap-2 rounded-(--r-pill)",
            "bg-(--brand) px-4 py-3 text-sm font-bold text-white shadow-(--shadow-brand)",
            "transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "hover:-translate-y-0.5 hover:bg-(--brand-hover)",
          )}
        >
          続きはチャットでお話しよう
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </a>
      ) : (
        <form
          onSubmit={handleSubmit}
          className={cn(
            "mt-3 flex items-center gap-2 rounded-(--r-pill)",
            "border border-(--paper-200) bg-(--paper-50) px-3 py-2",
            "transition-shadow duration-200 focus-within:border-(--teal-400) focus-within:shadow-(--ring-brand)",
          )}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ねっぷちゃんに話しかける…"
            disabled={isBusy}
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
      )}
    </div>
  );
};
