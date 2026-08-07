import { useChat } from "@ai-sdk/react";
import { PaperAirplaneIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { StopIcon } from "@heroicons/react/24/solid";
import { ChatMarkdown } from "@nepp-chan/shared/components/ChatMarkdown";
import { MiniChatHeader } from "@nepp-chan/shared/components/MiniChatHeader";
import { ScrollToBottomButton } from "@nepp-chan/shared/components/ScrollToBottomButton";
import { SpeechBubble } from "@nepp-chan/shared/components/SpeechBubble";
import {
  INITIAL_MESSAGE,
  SAMPLE_QUESTIONS,
} from "@nepp-chan/shared/constants/chat-defaults";
import { useStickToBottom } from "@nepp-chan/shared/hooks/useStickToBottom";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { messageText } from "@nepp-chan/shared/lib/message-text";
import { getToolDisplayName } from "@nepp-chan/shared/lib/tool-display-text";
import { Spinner } from "@nepp-chan/shared/ui/Loading";
import {
  DefaultChatTransport,
  getToolOrDynamicToolName,
  isToolOrDynamicToolUIPart,
} from "ai";
import { type SubmitEvent, useEffect, useMemo, useState } from "react";
import { acquireAnonymousSession } from "./anonymous-session";
import { CLOSE_MESSAGE_TYPE } from "./messages";
import { createThread } from "./thread";

type Props = {
  apiUrl: string;
  webUrl: string;
  iconSrc?: string;
};

const closeWidget = () => {
  window.parent.postMessage({ type: CLOSE_MESSAGE_TYPE }, "*");
};

const WaitingIndicator = ({
  toolName,
  className,
}: {
  toolName?: string;
  className?: string;
}) =>
  toolName ? (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-(--fg-3)",
        className,
      )}
    >
      <Spinner size="sm" />
      {getToolDisplayName(toolName, true)}
    </span>
  ) : (
    <span
      role="status"
      aria-label="回答を生成中"
      className={cn(
        "inline-block size-2 rounded-full bg-orange-500 animate-pulse",
        className,
      )}
    />
  );

export const WidgetChat = ({
  apiUrl,
  webUrl,
  iconSrc = "/mascot/icon.png",
}: Props) => {
  const [token, setToken] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState(false);
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    acquireAnonymousSession(apiUrl)
      .then((session) =>
        createThread(apiUrl, session.token).then((id) => {
          setToken(session.token);
          setThreadId(id);
        }),
      )
      .catch(() => setBootstrapError(true));
  }, [apiUrl]);

  const isReady = token !== null && threadId !== null;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${apiUrl}/threads/${threadId}/chat`,
        headers: (): Record<string, string> =>
          token ? { Authorization: `Bearer ${token}` } : {},
        prepareSendMessagesRequest({ messages }) {
          return {
            body: {
              message: messages[messages.length - 1],
            },
          };
        },
      }),
    [apiUrl, threadId, token],
  );

  const { messages, sendMessage, status, error, stop } = useChat({
    // threadId 確定時に id を変えて transport の再生成を強制する
    // （useChat は id が変わらない限り transport の更新を反映しない）
    id: threadId ?? "pending",
    messages: [INITIAL_MESSAGE],
    transport,
    experimental_throttle: 50,
  });

  const isBusy = status === "submitted" || status === "streaming";
  // ツール呼び出し中はテキストパートが途切れるので、最後のパートが text 以外なら
  // （ツール実行中のステップ境界等）待機インジケータを再表示する
  const lastMessage = messages[messages.length - 1];
  const lastPart = lastMessage?.parts[lastMessage.parts.length - 1];
  const isWaitingForText =
    status === "submitted" ||
    (status === "streaming" &&
      lastPart !== undefined &&
      lastPart.type !== "text");
  // 委譲中は Mastra の data-tool-agent パートが末尾に積まれ続けるため、
  // 末尾ではなく直近のツールパートから実行中のツール名を引く
  const activeToolPart = lastMessage?.parts
    .filter(isToolOrDynamicToolUIPart)
    .at(-1);
  const activeToolName = activeToolPart
    ? getToolOrDynamicToolName(activeToolPart)
    : undefined;

  const { viewportRef, isAtBottom, scrollToBottom } =
    useStickToBottom(messages);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.isComposing) closeWidget();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const ask = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || isBusy || !isReady) return;
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
      <MiniChatHeader
        iconSrc={iconSrc}
        className="px-4 py-3"
        action={
          <button
            type="button"
            onClick={closeWidget}
            aria-label="チャットを閉じる"
            className="ml-auto grid size-8 place-items-center rounded-full text-(--fg-3) transition-colors hover:bg-(--paper-100) hover:text-(--fg-1)"
          >
            <XMarkIcon className="size-[18px]" aria-hidden="true" />
          </button>
        }
      />

      <div
        ref={viewportRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4"
      >
        {messages.map((m, index) => {
          const text = messageText(m);
          const showIndicatorHere =
            index === messages.length - 1 &&
            m.role === "assistant" &&
            isWaitingForText;
          if (!text && !showIndicatorHere) return null;
          const bubbleVariant = m.role === "user" ? "user" : "assistant";
          return (
            <SpeechBubble
              key={m.id}
              variant={bubbleVariant}
              className={cn(
                "animate-[lp-bubble-in_400ms_cubic-bezier(0.22,1,0.36,1)]",
                bubbleVariant === "user" ? "self-end" : "self-start",
              )}
            >
              {text && <ChatMarkdown text={text} variant={bubbleVariant} />}
              {showIndicatorHere && (
                <WaitingIndicator
                  toolName={activeToolName}
                  className="mt-1 first:mt-0"
                />
              )}
            </SpeechBubble>
          );
        })}
        {/* 送信直後でまだアシスタントのメッセージが無い間は独立した吹き出しで出す */}
        {isWaitingForText && messages.at(-1)?.role !== "assistant" && (
          <SpeechBubble variant="assistant" className="flex self-start">
            <WaitingIndicator toolName={activeToolName} />
          </SpeechBubble>
        )}
        {(error || bootstrapError) && (
          <div className="w-fit max-w-[85%] self-start rounded-(--r-bubble) bg-red-50 px-[18px] py-3 text-sm text-red-700">
            通信エラーが発生したよ。もう一度試してみてね。
          </div>
        )}

        <div className="pointer-events-none sticky bottom-0 mt-auto flex justify-center pt-2">
          <ScrollToBottomButton
            isAtBottom={isAtBottom}
            onClick={() => scrollToBottom()}
            className="pointer-events-auto"
          />
        </div>
      </div>

      {showSuggestions && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              disabled={isBusy || !isReady}
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
          className="flex-1 border-0 bg-transparent text-base outline-none placeholder:text-(--fg-4)"
        />
        {isBusy ? (
          <button
            type="button"
            onClick={stop}
            aria-label="停止"
            className={cn(
              "grid size-8 place-items-center rounded-full bg-(--paper-100) text-(--fg-2)",
              "transition-colors hover:bg-(--paper-200)",
            )}
          >
            <StopIcon className="size-3" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!isReady || !input.trim()}
            aria-label="送信"
            className={cn(
              "grid size-8 place-items-center rounded-full bg-(--teal-700) text-white",
              "transition-colors hover:bg-(--teal-800)",
              "disabled:cursor-not-allowed disabled:opacity-55",
            )}
          >
            <PaperAirplaneIcon className="size-[18px]" aria-hidden="true" />
          </button>
        )}
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
