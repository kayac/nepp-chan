import { useChat } from "@ai-sdk/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { DefaultChatTransport, isToolOrDynamicToolUIPart } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { threadKeys, useCreateThread, useThreads } from "~/hooks/useThreads";
import { API_BASE } from "~/lib/api/client";
import { getResourceId } from "~/lib/resource";
import { submitFeedback } from "~/repository/feedback-repository";
import { fetchMessages } from "~/repository/thread-repository";
import type {
  ConversationContext,
  FeedbackCategory,
  FeedbackRating,
  Thread,
  ToolExecution,
} from "~/types";

import { ChatInput } from "./ChatInput";
import { FeedbackModal } from "./FeedbackModal";
import { MessageList } from "./MessageList";

type FeedbackModalState = {
  isOpen: boolean;
  messageId: string;
  rating: FeedbackRating;
} | null;

const getMessageContent = (message: UIMessage): string =>
  message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

const getToolNameFromPart = (part: { type: string; toolName?: string }) => {
  if ("toolName" in part && part.toolName) return part.toolName;
  const match = part.type.match(/^tool-(.+)$/);
  return match ? match[1] : part.type;
};

const extractConversationContext = (
  messages: UIMessage[],
  targetMessageId: string,
): ConversationContext | null => {
  const targetIndex = messages.findIndex((m) => m.id === targetMessageId);
  if (targetIndex === -1) return null;

  const targetMessage = messages[targetIndex];
  // 直前のユーザー入力のみ取得
  const previousMessage =
    targetIndex > 0 ? messages[targetIndex - 1] : undefined;

  return {
    targetMessage: {
      id: targetMessage.id,
      role: targetMessage.role,
      content: getMessageContent(targetMessage),
    },
    previousMessages: previousMessage
      ? [
          {
            id: previousMessage.id,
            role: previousMessage.role,
            content: getMessageContent(previousMessage),
          },
        ]
      : [],
    nextMessages: [],
  };
};

const extractToolExecutions = (message: UIMessage): ToolExecution[] =>
  message.parts.filter(isToolOrDynamicToolUIPart).map((part) => ({
    toolName: getToolNameFromPart(part),
    state: part.state,
    input: "input" in part ? part.input : undefined,
    output: "output" in part ? part.output : undefined,
    errorText: "errorText" in part ? (part.errorText as string) : undefined,
  }));

export const ChatContainer = () => {
  const resourceId = useMemo(() => getResourceId(), []);
  const queryClient = useQueryClient();

  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const hasInitialized = useRef(false);

  const [submittedFeedbacks, setSubmittedFeedbacks] = useState<
    Record<string, FeedbackRating>
  >({});
  const [feedbackModal, setFeedbackModal] = useState<FeedbackModalState>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const { data: threadsData, isSuccess: threadsLoaded } =
    useThreads(resourceId);
  const threads = threadsData?.threads ?? [];

  const createThreadMutation = useCreateThread(resourceId);

  const threadId = currentThreadId ?? "";

  const { messages, status, error, sendMessage, setMessages } = useChat({
    id: threadId,
    transport: useMemo(
      () =>
        new DefaultChatTransport({
          api: `${API_BASE}/chat`,
          prepareSendMessagesRequest({ messages }) {
            const lastMessage = messages[messages.length - 1];
            return {
              body: {
                message: lastMessage,
                resourceId,
                threadId,
              },
            };
          },
        }),
      [resourceId, threadId],
    ),
  });

  const loadMessages = useCallback(
    async (targetThreadId: string) => {
      setIsLoadingMessages(true);
      try {
        const result = await queryClient.fetchQuery({
          queryKey: threadKeys.messages(targetThreadId),
          queryFn: () => fetchMessages(targetThreadId),
        });
        setMessages(result.messages);
      } catch (err) {
        console.error("Failed to load messages:", err);
        setMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [queryClient, setMessages],
  );

  const handleNewThread = useCallback(async () => {
    if (createThreadMutation.isPending) return;
    const thread = await createThreadMutation.mutateAsync(undefined);
    setMessages([]);
    setCurrentThreadId(thread.id);
    setIsSidebarOpen(false);
  }, [createThreadMutation, setMessages]);

  const handleSelectThread = useCallback(
    async (selectedThreadId: string) => {
      if (selectedThreadId === currentThreadId) {
        setIsSidebarOpen(false);
        return;
      }
      setCurrentThreadId(selectedThreadId);
      setIsSidebarOpen(false);
      await loadMessages(selectedThreadId);
    },
    [currentThreadId, loadMessages],
  );

  // 初回ロード時に最初のスレッドを選択
  useEffect(() => {
    if (threadsLoaded && !hasInitialized.current) {
      hasInitialized.current = true;
      if (threads.length > 0) {
        const firstThread = threads[0];
        setCurrentThreadId(firstThread.id);
        loadMessages(firstThread.id);
      }
    }
  }, [threadsLoaded, threads, loadMessages]);

  // スレッドがない場合は新規作成
  useEffect(() => {
    if (
      threadsLoaded &&
      hasInitialized.current &&
      threads.length === 0 &&
      currentThreadId === null
    ) {
      handleNewThread();
    }
  }, [threadsLoaded, threads.length, currentThreadId, handleNewThread]);

  const isLoading =
    status === "streaming" || status === "submitted" || isLoadingMessages;

  const handleSend = (content: string) => {
    if (!threadId) return;
    sendMessage({ text: content });
  };

  const handleFeedbackClick = useCallback(
    (messageId: string, rating: FeedbackRating) => {
      setFeedbackModal({ isOpen: true, messageId, rating });
    },
    [],
  );

  const handleFeedbackSubmit = useCallback(
    async (data: { category?: FeedbackCategory; comment?: string }) => {
      if (!feedbackModal || !threadId) return;

      const targetMessage = messages.find(
        (m) => m.id === feedbackModal.messageId,
      );
      if (!targetMessage) return;

      const conversationContext = extractConversationContext(
        messages,
        feedbackModal.messageId,
      );
      if (!conversationContext) return;

      const toolExecutions = extractToolExecutions(targetMessage);

      setIsSubmittingFeedback(true);
      try {
        await submitFeedback({
          threadId,
          messageId: feedbackModal.messageId,
          rating: feedbackModal.rating,
          category: data.category,
          comment: data.comment,
          conversationContext,
          toolExecutions:
            toolExecutions.length > 0 ? toolExecutions : undefined,
        });

        setSubmittedFeedbacks((prev) => ({
          ...prev,
          [feedbackModal.messageId]: feedbackModal.rating,
        }));
        setFeedbackModal(null);
      } catch (err) {
        console.error("Failed to submit feedback:", err);
      } finally {
        setIsSubmittingFeedback(false);
      }
    },
    [feedbackModal, threadId, messages],
  );

  const handleFeedbackModalClose = useCallback(() => {
    setFeedbackModal(null);
  }, []);

  return (
    <div className="flex h-dvh bg-white">
      {/* Sidebar */}
      {isSidebarOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 bg-black/20 z-10 md:hidden cursor-default"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="サイドバーを閉じる"
          />
          <aside className="fixed md:relative z-20 w-72 h-full bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col animate-fade-in">
            <div className="p-4 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">スレッド</span>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 hover:bg-white/60 rounded transition-colors"
                  aria-label="閉じる"
                >
                  <XMarkIcon
                    className="w-5 h-5 text-[var(--color-text-muted)]"
                    aria-hidden="true"
                  />
                </button>
              </div>
              <button
                type="button"
                onClick={handleNewThread}
                className="w-full py-2.5 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                新しい会話
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {threads.map((thread: Thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => handleSelectThread(thread.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-white/60 transition-colors ${
                    thread.id === currentThreadId ? "bg-white" : ""
                  }`}
                >
                  <div className="text-sm font-medium text-[var(--color-text)] truncate">
                    {thread.title ?? "新しい会話"}
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {new Date(thread.updatedAt).toLocaleDateString("ja-JP")}
                  </div>
                </button>
              ))}
            </nav>
          </aside>
        </>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-[var(--color-border)] bg-white px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
              aria-label="メニュー"
            >
              <Bars3Icon
                className="w-5 h-5 text-[var(--color-text-muted)]"
                aria-hidden="true"
              />
            </button>
            <h1 className="text-base font-semibold">ねっぷちゃん</h1>
          </div>
          <button
            type="button"
            onClick={handleNewThread}
            className="text-sm text-[var(--color-accent)] hover:underline"
          >
            新規作成
          </button>
        </header>

        <MessageList
          messages={messages}
          isLoading={isLoading}
          onFeedbackClick={handleFeedbackClick}
          submittedFeedbacks={submittedFeedbacks}
        />

        {error && (
          <div className="mx-4 mb-2 px-4 py-2 bg-red-50 text-red-600 text-sm rounded-lg">
            {error.message}
          </div>
        )}

        <ChatInput onSend={handleSend} disabled={isLoading || !threadId} />
      </main>

      {feedbackModal && (
        <FeedbackModal
          isOpen={feedbackModal.isOpen}
          onClose={handleFeedbackModalClose}
          rating={feedbackModal.rating}
          onSubmit={handleFeedbackSubmit}
          isSubmitting={isSubmittingFeedback}
        />
      )}
    </div>
  );
};
