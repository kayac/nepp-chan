import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowRightIcon, EllipsisIcon, PlusIcon } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

const messageText = (msg: UIMessage) =>
  msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");

// ツール ID → ユーザー向け活動ラベル。未登録のツールは generic な文言にフォールバックする。
const TOOL_ACTIVITY_LABEL: Record<string, string> = {
  "knowledge-search": "村のことを調べているよ",
  "google-search": "ウェブで調べているよ",
  "village-search": "村について調べているよ",
  "emergency-report": "情報を書き留めているよ",
  "broadcast-get": "お知らせを確認しているよ",
};

const isAssistantToolPartActive = (part: {
  type: string;
  state?: string;
  toolName?: string;
}) => {
  if (part.type !== "dynamic-tool" && !part.type.startsWith("tool-")) {
    return false;
  }
  return part.state === "input-streaming" || part.state === "input-available";
};

const getActivityLabel = (msg: UIMessage | undefined): string => {
  if (!msg || msg.role !== "assistant") return "考え中…";
  // 直近の active なツール部分を後ろから探す
  for (let i = msg.parts.length - 1; i >= 0; i--) {
    const part = msg.parts[i] as {
      type: string;
      state?: string;
      toolName?: string;
    };
    if (!isAssistantToolPartActive(part)) continue;
    const toolName =
      part.type === "dynamic-tool"
        ? (part.toolName ?? "tool")
        : part.type.slice("tool-".length);
    return `${TOOL_ACTIVITY_LABEL[toolName] ?? "ちょっと調べているよ"}…`;
  }
  return "考え中…";
};

export const MiniChat = () => {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const streamRef = useRef<HTMLDivElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${API_BASE}/simple-chat`,
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
  const lastMessage = messages[messages.length - 1];
  // dots は「アシスタントのテキストがまだ届いていない間」表示し続けたい。
  // ツール実行中など、空 parts の assistant message が先に挿入されるケースもカバー。
  const isAwaitingResponse =
    isBusy &&
    (!lastMessage ||
      lastMessage.role === "user" ||
      messageText(lastMessage).length === 0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: messages/status 変更時に最下部追従させたい
  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

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
                }}
              >
                {text}
              </ReactMarkdown>
            </div>
          );
        })}
        {isAwaitingResponse && (
          <div className="flex w-fit max-w-[78%] items-center gap-2 self-start rounded-(--r-bubble) bg-(--paper-50) px-[18px] py-3">
            <span className="size-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-xs font-medium text-(--fg-2)">
              {getActivityLabel(lastMessage)}
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
