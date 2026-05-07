import { useChat } from "@ai-sdk/react";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowRightIcon, EllipsisIcon, SendIcon } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_URL, WEB_URL } from "~/constants/urls";

const SAMPLE_QUESTIONS: ReadonlyArray<string> = [
  "移住の補助金はある？",
  "音威子府駅ってどんなところ？",
  "おすすめのお蕎麦屋さんは？",
  "今日のゴミの日は？",
];

const INITIAL_MESSAGE: UIMessage = {
  id: "initial-greeting",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "こんにちは〜！ねっぷちゃんだよ 😊\n音威子府のことなら、なんでも聞いてみてね！",
    },
  ],
};

const messageText = (msg: UIMessage) =>
  msg.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");

export const MiniChat = () => {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const streamRef = useRef<HTMLDivElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_URL}/simple-chat`,
        prepareSendMessagesRequest({ messages: msgs }) {
          return { body: { message: msgs[msgs.length - 1] } };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error } = useChat({
    messages: [INITIAL_MESSAGE],
    transport,
    experimental_throttle: 50,
  });

  const isBusy = status === "submitted" || status === "streaming";
  const hasCompletedExchange =
    status === "ready" && messages.some((m) => m.role === "user");

  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    const observer = new MutationObserver(() => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom < 80) {
        el.scrollTop = el.scrollHeight;
      }
    });
    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, []);

  const ask = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || isBusy) return;
    sendMessage({ text: trimmed });
    setInput("");
    setShowSuggestions(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  return (
    <div className="flex flex-col rounded-[28px] border border-(--paper-200) bg-white p-5 shadow-(--shadow-float-md)">
      <div className="flex items-center gap-3 border-b border-(--paper-200) pb-3">
        <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-(--teal-50)">
          <img
            src="/mascot/expr-wave-smile.png"
            alt=""
            className="size-[34px] object-contain"
          />
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
                  ? "self-end bg-(--teal-700) text-white"
                  : "self-start bg-(--paper-50) text-(--fg-1)",
              )}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p className="my-1 first:mt-0 last:mb-0">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="my-1 list-disc pl-5 first:mt-0 last:mb-0">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-1 list-decimal pl-5 first:mt-0 last:mb-0">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="my-0.5">{children}</li>,
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "underline underline-offset-2",
                        m.role === "user"
                          ? "text-white/90 hover:text-white"
                          : "text-(--brand) hover:text-(--brand-hover)",
                      )}
                    >
                      {children}
                    </a>
                  ),
                  code: ({ children }) => (
                    <code
                      className={cn(
                        "rounded px-1 py-0.5 font-mono text-[0.85em]",
                        m.role === "user"
                          ? "bg-white/15"
                          : "bg-(--paper-200) text-(--fg-1)",
                      )}
                    >
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre
                      className={cn(
                        "my-1 overflow-x-auto rounded p-2 text-[0.8em] first:mt-0 last:mb-0",
                        m.role === "user"
                          ? "bg-white/10"
                          : "bg-(--paper-200) text-(--fg-1)",
                      )}
                    >
                      {children}
                    </pre>
                  ),
                }}
              >
                {text}
              </ReactMarkdown>
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
          href={WEB_URL}
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
