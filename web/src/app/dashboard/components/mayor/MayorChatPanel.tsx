import { useChat } from "@ai-sdk/react";
import { PaperAirplaneIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { MiniChatHeader } from "@nepp-chan/shared/components/MiniChatHeader";
import { SpeechBubble } from "@nepp-chan/shared/components/SpeechBubble";
import { cn } from "@nepp-chan/shared/lib/class-merge";
import { LoadingDots } from "@nepp-chan/shared/ui/Loading";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStickToBottom } from "~/components/chat/hooks/useStickToBottom";
import { MessageParts } from "~/components/chat/MessageParts";
import { createThreadChatTransport } from "~/lib/api/chat-transport";
import { threadRepository } from "~/lib/api/repository";

export type MayorRequest = { context: string };

interface Props {
  isOpen: boolean;
  request: MayorRequest | null;
  onClose: () => void;
}

const FOLLOW_UPS = ["元の声を見せて", "先月と比べて", "打ち手を教えて"];

const MayorChat = ({
  threadId,
  request,
}: {
  threadId: string;
  request: MayorRequest | null;
}) => {
  const transport = useMemo(
    () => createThreadChatTransport(threadId),
    [threadId],
  );

  const { messages, status, sendMessage } = useChat({
    id: threadId,
    transport,
  });
  const isRunning = status === "submitted" || status === "streaming";

  const lastRequest = useRef<MayorRequest | null>(null);
  useEffect(() => {
    if (!request || request === lastRequest.current) return;
    lastRequest.current = request;
    void sendMessage({ text: `「${request.context}」の声を分析して` });
  }, [request, sendMessage]);

  const [input, setInput] = useState("");
  const { viewportRef } = useStickToBottom(messages);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isRunning) return;
    setInput("");
    void sendMessage({ text });
  };

  return (
    <>
      <div ref={viewportRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {request && (
          <div className="text-xs text-(--fg-3) bg-(--bg-sunken) rounded-lg px-3 py-2">
            📊 {request.context} について
          </div>
        )}
        {messages.length === 0 && !isRunning && (
          <p className="text-sm text-(--fg-3) text-center py-6">
            気になるデータのこと、なんでも聞いてね。
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <SpeechBubble
              variant={message.role === "user" ? "user" : "assistant"}
              className="max-w-[88%] text-sm"
            >
              <MessageParts message={message} />
            </SpeechBubble>
          </div>
        ))}
        {isRunning && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <SpeechBubble variant="assistant" className="py-3">
              <LoadingDots />
            </SpeechBubble>
          </div>
        )}
      </div>

      <div className="border-t border-(--border-1) p-3 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {FOLLOW_UPS.map((label) => (
            <button
              key={label}
              type="button"
              disabled={isRunning}
              onClick={() => void sendMessage({ text: label })}
              className="px-2.5 py-1 rounded-(--r-pill) bg-(--bg-sunken) text-xs text-(--fg-2) hover:bg-(--brand-soft) disabled:opacity-50 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="このデータについて聞く…"
            className="flex-1 rounded-(--r-pill) border border-(--border-1) bg-(--bg-raised) px-3.5 py-2 text-sm text-(--fg-1) placeholder:text-(--fg-4) focus:outline-none focus:border-(--brand)"
          />
          <button
            type="submit"
            aria-label="送信"
            disabled={isRunning || input.trim().length === 0}
            className="p-2 rounded-full bg-(--brand) text-(--fg-on-brand) hover:bg-(--brand-press) disabled:opacity-50"
          >
            <PaperAirplaneIcon className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>
      </div>
    </>
  );
};

export const MayorChatPanel = ({ isOpen, request, onClose }: Props) => {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [createFailed, setCreateFailed] = useState(false);
  const isCreating = useRef(false);

  useEffect(() => {
    if (!isOpen || threadId || createFailed || isCreating.current) return;
    isCreating.current = true;
    threadRepository
      .createThread("村長モード")
      .then((thread) => setThreadId(thread.id))
      .catch(() => {
        isCreating.current = false;
        setCreateFailed(true);
      });
  }, [isOpen, threadId, createFailed]);

  return (
    <aside
      aria-label="村長モードチャット"
      inert={!isOpen}
      className={cn(
        "fixed top-0 right-0 z-30 h-dvh w-[424px] max-w-full",
        "bg-(--bg-app) border-l border-(--border-1) shadow-(--shadow-lg)",
        "flex flex-col transition-transform duration-200 ease-out",
        isOpen ? "translate-x-0" : "translate-x-full",
      )}
    >
      <MiniChatHeader
        className="p-4 bg-(--bg-raised)"
        action={
          <div className="ml-auto flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-(--r-pill) bg-(--admin-bg) border border-(--admin-border) text-xs font-bold text-(--fg-1)">
              👑 村長モード
            </span>
            <button
              type="button"
              aria-label="閉じる"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-(--bg-sunken) transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-(--fg-3)" aria-hidden="true" />
            </button>
          </div>
        }
      />
      {threadId ? (
        <MayorChat threadId={threadId} request={request} />
      ) : createFailed ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-(--fg-2)">
            チャットの準備に失敗しました。通信環境を確認してもう一度お試しください。
          </p>
          <button
            type="button"
            onClick={() => setCreateFailed(false)}
            className="px-4 py-1.5 rounded-(--r-pill) bg-(--brand) text-(--fg-on-brand) text-sm font-medium hover:bg-(--brand-press)"
          >
            もう一度試す
          </button>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <LoadingDots />
        </div>
      )}
    </aside>
  );
};
