import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Thread } from "~/components/assistant-ui/Thread";
import { threadKeys, useCreateThread, useThreads } from "~/hooks/useThreads";
import { getResourceId } from "~/lib/resource";
import { fetchMessages } from "~/repository/thread-repository";
import type { FeedbackRating, Thread as ThreadType } from "~/types";

import { AssistantProvider } from "./AssistantProvider";
import { FeedbackProvider } from "./FeedbackContext";

export const ChatPage = () => {
  const resourceId = useMemo(() => getResourceId(), []);

  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [submittedFeedbacks, setSubmittedFeedbacks] = useState<
    Record<string, FeedbackRating>
  >({});
  const hasInitialized = useRef(false);

  const handleFeedbackClick = useCallback(
    (messageId: string, rating: FeedbackRating) => {
      setSubmittedFeedbacks((prev) => ({ ...prev, [messageId]: rating }));
      // TODO: サーバーへのフィードバック送信を実装
    },
    [],
  );

  const { data: threadsData, isSuccess: threadsLoaded } =
    useThreads(resourceId);
  const threads = threadsData?.threads ?? [];

  const createThreadMutation = useCreateThread(resourceId);

  // 現在のスレッドのメッセージを取得
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: threadKeys.messages(currentThreadId ?? ""),
    queryFn: () => fetchMessages(currentThreadId ?? ""),
    enabled: !!currentThreadId,
  });
  const initialMessages = messagesData?.messages;

  const handleNewThread = useCallback(async () => {
    if (createThreadMutation.isPending) return;
    const thread = await createThreadMutation.mutateAsync(undefined);
    setCurrentThreadId(thread.id);
    setIsSidebarOpen(false);
  }, [createThreadMutation]);

  const handleSelectThread = useCallback(
    (selectedThreadId: string) => {
      if (selectedThreadId === currentThreadId) {
        setIsSidebarOpen(false);
        return;
      }
      setCurrentThreadId(selectedThreadId);
      setIsSidebarOpen(false);
    },
    [currentThreadId],
  );

  // threadId を localStorage に保存
  useEffect(() => {
    if (currentThreadId) {
      localStorage.setItem(`chat_threadId_${resourceId}`, currentThreadId);
    }
  }, [currentThreadId, resourceId]);

  // 初期化時に localStorage から復元
  useEffect(() => {
    if (threadsLoaded && !hasInitialized.current) {
      hasInitialized.current = true;
      if (threads.length > 0) {
        const savedThreadId = localStorage.getItem(
          `chat_threadId_${resourceId}`,
        );
        const thread =
          threads.find((t) => t.id === savedThreadId) ?? threads[0];
        setCurrentThreadId(thread.id);
      }
    }
  }, [threadsLoaded, threads, resourceId]);

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

  return (
    <div className="flex h-dvh bg-white">
      {isSidebarOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 bg-black/20 z-10 md:hidden cursor-default"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="サイドバーを閉じる"
          />
          <aside className="fixed md:relative z-20 w-72 h-full bg-(--color-surface) border-r border-(--color-border) flex flex-col animate-fade-in">
            <div className="p-4 border-b border-(--color-border)">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">スレッド</span>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 hover:bg-white/60 rounded transition-colors"
                  aria-label="閉じる"
                >
                  <XMarkIcon
                    className="w-5 h-5 text-(--color-text-muted)"
                    aria-hidden="true"
                  />
                </button>
              </div>
              <button
                type="button"
                onClick={handleNewThread}
                className="w-full py-2.5 bg-(--color-accent) text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                新しい会話
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-2">
              {threads.map((thread: ThreadType) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => handleSelectThread(thread.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-white/60 transition-colors ${
                    thread.id === currentThreadId ? "bg-white" : ""
                  }`}
                >
                  <div className="text-sm font-medium text-(--color-text) truncate">
                    {thread.title ?? "新しい会話"}
                  </div>
                  <div className="text-xs text-(--color-text-muted) mt-0.5">
                    {new Date(thread.updatedAt).toLocaleDateString("ja-JP")}
                  </div>
                </button>
              ))}
            </nav>
          </aside>
        </>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-(--color-border) bg-white px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 hover:bg-(--color-surface) rounded-lg transition-colors"
              aria-label="メニュー"
            >
              <Bars3Icon
                className="w-5 h-5 text-(--color-text-muted)"
                aria-hidden="true"
              />
            </button>
            <h1 className="text-base font-semibold">ねっぷちゃん</h1>
          </div>
          <button
            type="button"
            onClick={handleNewThread}
            className="text-sm text-(--color-accent) hover:underline"
          >
            新規作成
          </button>
        </header>

        {currentThreadId ? (
          <FeedbackProvider
            submittedFeedbacks={submittedFeedbacks}
            onFeedbackClick={handleFeedbackClick}
          >
            <AssistantProvider
              key={currentThreadId}
              threadId={currentThreadId}
              initialMessages={initialMessages}
            >
              <Thread />
            </AssistantProvider>
          </FeedbackProvider>
        ) : (
          <div className="flex-1 flex items-center justify-center text-(--color-text-muted)">
            {messagesLoading ? "読み込み中..." : "スレッドを選択してください"}
          </div>
        )}
      </main>
    </div>
  );
};
