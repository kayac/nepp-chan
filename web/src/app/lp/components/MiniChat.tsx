import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowRightIcon, EllipsisIcon, PlusIcon } from "lucide-react";
import {
  type FormEvent,
  Fragment,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { API_BASE } from "~/lib/api/client";
import { cn } from "~/lib/class-merge";

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

// `**bold**` を <strong> 要素に分解する。マークダウン全体を解釈せず装飾だけ最低限拾う。
const renderInlineBold = (line: string): ReactNode => {
  const parts = line.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => {
    const key = `${i}-${part}`;
    return i % 2 === 1 ? (
      <strong key={key}>{part}</strong>
    ) : (
      <Fragment key={key}>{part}</Fragment>
    );
  });
};

const messageText = (msg: UIMessage) =>
  msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");

export const MiniChat = () => {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const streamRef = useRef<HTMLDivElement | null>(null);

  const { messages, sendMessage, status } = useChat({
    messages: [INITIAL_MESSAGE],
    transport: new DefaultChatTransport({
      api: `${API_BASE}/simple-chat`,
      prepareSendMessagesRequest({ messages: msgs }) {
        return { body: { message: msgs[msgs.length - 1] } };
      },
    }),
  });

  const isBusy = status === "submitted" || status === "streaming";
  const lastMessage = messages[messages.length - 1];
  const isAwaitingFirstToken =
    isBusy && (!lastMessage || lastMessage.role === "user");

  // biome-ignore lint/correctness/useExhaustiveDependencies: messages/status 変更時に最下部追従させたい
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const ask = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || isBusy) return;
    setInput("");
    setShowSuggestions(false);
    sendMessage({ text: trimmed });
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
                "max-w-[86%] break-words rounded-(--r-bubble) px-[18px] py-3 text-sm leading-[1.7]",
                "animate-[lp-bubble-in_400ms_cubic-bezier(0.22,1,0.36,1)] shadow-(--shadow-float-sm)",
                m.role === "user"
                  ? "self-end bg-(--teal-700) text-white"
                  : "self-start bg-(--paper-50) text-(--fg-1)",
              )}
            >
              {text.split("\n").map((line, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: split の行順序は固定で id 単位でユニーク
                <div key={`${m.id}-${j}`}>{renderInlineBold(line)}</div>
              ))}
            </div>
          );
        })}
        {isAwaitingFirstToken && (
          <div className="flex max-w-[86%] items-center gap-1.5 self-start rounded-(--r-bubble) bg-(--paper-50) px-[18px] py-3">
            {[0, 1, 2].map((dotIndex) => (
              <span
                key={`typing-dot-${dotIndex}`}
                className="size-[7px] rounded-full bg-(--teal-500) opacity-35 animate-[lp-bubble-typing_1.2s_infinite]"
                style={{ animationDelay: `${dotIndex * 0.15}s` }}
              />
            ))}
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

      <form
        onSubmit={handleSubmit}
        className={cn(
          "mt-3 flex items-center gap-2 rounded-(--r-pill)",
          "border border-(--paper-200) bg-(--paper-50) px-3 py-2",
          "transition-shadow duration-200 focus-within:border-(--teal-400) focus-within:shadow-(--ring-brand)",
        )}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="添付"
          className="grid size-7 place-items-center rounded-full text-(--fg-3) transition-colors hover:bg-(--teal-50) hover:text-(--teal-700)"
        >
          <PlusIcon className="size-[18px]" aria-hidden="true" />
        </button>
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
          <ArrowRightIcon className="size-[18px]" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
};
