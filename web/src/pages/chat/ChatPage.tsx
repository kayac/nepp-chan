import { Bars3Icon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Thread } from "~/components/assistant-ui/Thread";
import { LoadingDots } from "~/components/ui/loading";
import { threadKeys, useCreateThread, useThreads } from "~/hooks/useThreads";
import { cn } from "~/lib/class-merge";
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
    },
    [],
  );

  const { data: threadsData, isSuccess: threadsLoaded } =
    useThreads(resourceId);
  const threads = threadsData?.threads ?? [];

  const createThreadMutation = useCreateThread(resourceId);

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

  useEffect(() => {
    if (currentThreadId) {
      localStorage.setItem(`chat_threadId_${resourceId}`, currentThreadId);
    }
  }, [currentThreadId, resourceId]);

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
    <div className="flex h-dvh bg-(--color-bg)">
      {/* サイドバーオーバーレイ */}
      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-stone-900/20 backdrop-blur-[2px] z-10 md:hidden cursor-default transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="サイドバーを閉じる"
        />
      )}

      {/* サイドバー */}
      <aside
        className={cn(
          "fixed md:relative z-20 w-72 h-full bg-(--color-surface) border-r border-(--color-border) flex flex-col",
          "transition-transform duration-200 ease-out",
          isSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0 md:hidden",
        )}
      >
        <div className="p-4 border-b border-(--color-border)">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-(--color-text-secondary)">
              スレッド
            </span>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 hover:bg-(--color-surface-hover) rounded-lg transition-colors"
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
            disabled={createThreadMutation.isPending}
            className={cn(
              "w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
              "bg-(--color-accent) text-white",
              "hover:bg-(--color-accent-hover)",
              "active:scale-[0.98]",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              "flex items-center justify-center gap-2",
            )}
          >
            {createThreadMutation.isPending ? (
              <LoadingDots size="sm" />
            ) : (
              <>
                <PlusIcon className="w-4 h-4" />
                新しい会話
              </>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {threads.map((thread: ThreadType) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => handleSelectThread(thread.id)}
              className={cn(
                "w-full px-4 py-3 text-left transition-colors",
                "hover:bg-(--color-surface-hover)",
                thread.id === currentThreadId &&
                  "bg-(--color-surface-hover) border-l-2 border-(--color-accent)",
              )}
            >
              <div
                className={cn(
                  "text-sm font-medium truncate",
                  thread.id === currentThreadId
                    ? "text-(--color-text)"
                    : "text-(--color-text-secondary)",
                )}
              >
                {thread.title ?? "新しい会話"}
              </div>
              <div className="text-xs text-(--color-text-faint) mt-0.5">
                {new Date(thread.updatedAt).toLocaleDateString("ja-JP")}
              </div>
            </button>
          ))}
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 h-14 border-b border-(--color-border) bg-(--color-surface) px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 hover:bg-(--color-surface-hover) rounded-lg transition-colors"
              aria-label="メニュー"
            >
              <Bars3Icon
                className="w-5 h-5 text-(--color-text-muted)"
                aria-hidden="true"
              />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-(--color-accent) flex items-center justify-center">
                <span className="text-white text-xs font-bold">ね</span>
              </div>
              <h1 className="text-base font-semibold text-(--color-text)">
                ねっぷちゃん
              </h1>
            </div>
          </div>
          <button
            type="button"
            onClick={handleNewThread}
            disabled={createThreadMutation.isPending}
            className="text-sm text-(--color-accent) hover:text-(--color-accent-hover) transition-colors disabled:opacity-60 flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" />
            新しい会話
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
          <div className="flex-1 flex items-center justify-center">
            {messagesLoading ? (
              <div className="flex flex-col items-center gap-3">
                <LoadingDots />
                <span className="text-sm text-(--color-text-muted)">
                  読み込み中
                </span>
              </div>
            ) : (
              <span className="text-(--color-text-muted)">
                スレッドを選択してください
              </span>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
