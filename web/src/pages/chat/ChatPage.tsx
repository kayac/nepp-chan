import {
  Bars3Icon,
  Cog6ToothIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Thread } from "~/components/assistant-ui/Thread";
import { LoadingDots } from "~/components/ui/Loading";
import { useAdminUser } from "~/hooks/useAdminUser";
import {
  threadKeys,
  useCreateThread,
  useDeleteThread,
  useThreads,
} from "~/hooks/useThreads";
import { cn } from "~/lib/class-merge";
import { getResourceId } from "~/lib/resource";
import { fetchMessages } from "~/repository/thread-repository";
import type { Thread as ThreadType } from "~/types";

import {
  AssistantProvider,
  GREETING_PROMPT,
  ONBOARDING_PROMPT,
} from "./AssistantProvider";
import { FeedbackModal } from "./components/FeedbackModal";
import { FeedbackProvider, useFeedback } from "./FeedbackContext";

const FeedbackModalWrapper = () => {
  const {
    feedbackModal,
    isSubmitting,
    onFeedbackSubmit,
    onFeedbackModalClose,
  } = useFeedback();

  if (!feedbackModal) return null;

  return (
    <FeedbackModal
      isOpen={feedbackModal.isOpen}
      onClose={onFeedbackModalClose}
      rating={feedbackModal.rating}
      onSubmit={onFeedbackSubmit}
      isSubmitting={isSubmitting}
    />
  );
};

export const ChatPage = () => {
  const resourceId = useMemo(() => getResourceId(), []);
  const { data: adminUser, isLoading: isAdminLoading } = useAdminUser();
  const isAdmin = !!adminUser;

  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [greetingPrompt, setGreetingPrompt] = useState<string>();
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  const isFirstVisit = useRef(false);

  const { data: threadsData, isSuccess: threadsLoaded } =
    useThreads(resourceId);
  const threads = threadsData?.threads ?? [];

  const createThreadMutation = useCreateThread(resourceId);
  const deleteThreadMutation = useDeleteThread(resourceId);

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
    if (isFirstVisit.current) {
      setGreetingPrompt(ONBOARDING_PROMPT);
      isFirstVisit.current = false;
    } else {
      setGreetingPrompt(GREETING_PROMPT);
    }
    setIsSidebarOpen(false);
  }, [createThreadMutation]);

  const handleSelectThread = useCallback(
    (selectedThreadId: string) => {
      if (selectedThreadId === currentThreadId) {
        setIsSidebarOpen(false);
        return;
      }
      setCurrentThreadId(selectedThreadId);
      setGreetingPrompt(undefined);
      setIsSidebarOpen(false);
    },
    [currentThreadId],
  );

  const handleDeleteThread = useCallback(async () => {
    if (!threadToDelete || deleteThreadMutation.isPending) return;

    try {
      await deleteThreadMutation.mutateAsync(threadToDelete);

      if (threadToDelete === currentThreadId) {
        const remaining = threads.filter((t) => t.id !== threadToDelete);
        setCurrentThreadId(remaining.length > 0 ? remaining[0].id : null);
        setGreetingPrompt(undefined);
      }

      setThreadToDelete(null);
    } catch {
      // 削除失敗時はモーダルを維持（isPendingが解除されるので再試行可能）
    }
  }, [threadToDelete, deleteThreadMutation, currentThreadId, threads]);

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
      } else {
        isFirstVisit.current = true;
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

  if (isAdminLoading) {
    return null;
  }

  return (
    <div className="flex h-dvh bg-(--color-bg)">
      {/* サイドバーオーバーレイ */}
      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-stone-900/25 backdrop-blur-[3px] z-10 md:hidden cursor-default animate-fade-in"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="サイドバーを閉じる"
        />
      )}

      {/* サイドバー */}
      <aside
        className={cn(
          "fixed md:relative z-20 w-72 h-full bg-(--color-surface) border-r border-(--color-border)/80 flex flex-col",
          "transition-transform duration-200 ease-out",
          isSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0 md:hidden",
        )}
      >
        <div className="p-4 border-b border-(--color-border)/60">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-(--color-text-secondary) tracking-wide">
              スレッド
            </span>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 hover:bg-(--color-surface-hover) rounded-lg transition-all duration-150 hover:scale-105"
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
              "w-full py-3 rounded-xl text-sm font-medium transition-all duration-200",
              "bg-(--color-accent) text-white",
              "hover:bg-(--color-accent-hover) hover:scale-[1.02]",
              "active:scale-[0.98]",
              "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100",
              "flex items-center justify-center gap-2",
            )}
            style={{ boxShadow: "var(--shadow-sm)" }}
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

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {threads.map((thread: ThreadType) => {
            const isSelected = thread.id === currentThreadId;
            return (
              <div
                key={thread.id}
                className={cn(
                  "group relative flex items-center rounded-xl mb-1 transition-all duration-150",
                  "hover:bg-(--color-surface-hover)",
                  isSelected
                    ? "bg-(--color-accent-subtle)/50 border-l-[3px] border-(--color-accent)"
                    : "border-l-[3px] border-transparent",
                )}
              >
                <button
                  type="button"
                  onClick={() => handleSelectThread(thread.id)}
                  className="flex-1 min-w-0 px-3 py-3 text-left"
                >
                  <div
                    className={cn(
                      "text-sm font-medium truncate",
                      isSelected
                        ? "text-(--color-text)"
                        : "text-(--color-text-secondary)",
                    )}
                  >
                    {thread.title ?? "新しい会話"}
                  </div>
                  <div className="text-xs text-(--color-text-faint) mt-1">
                    {new Date(thread.updatedAt).toLocaleDateString("ja-JP")}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setThreadToDelete(thread.id);
                  }}
                  className={cn(
                    "shrink-0 p-1.5 mr-2 rounded-lg transition-all duration-150",
                    "hover:bg-red-100 hover:text-red-600",
                    "text-(--color-text-muted)",
                    isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                  )}
                  aria-label="スレッドを削除"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 flex flex-col min-w-0">
        <header
          className={cn(
            "sticky top-0 z-10 bg-(--color-surface) px-4 md:px-6 flex flex-col shrink-0 transition-colors",
            !isAdmin && "border-b border-(--color-border)/60",
          )}
          style={{ boxShadow: isAdmin ? "none" : "var(--shadow-xs)" }}
        >
          {/* 管理者モードバナー */}
          {isAdmin && (
            <div className="h-9 -mx-4 md:-mx-6 px-4 md:px-6 bg-(--color-admin-bg) border-b border-(--color-admin-border)/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-(--color-admin) animate-pulse" />
                <span className="text-xs font-semibold text-(--color-admin) tracking-wide">
                  管理者モード
                </span>
              </div>
              <a
                href="/dashboard"
                className="flex items-center gap-1.5 text-xs font-medium text-(--color-admin) hover:text-(--color-admin-hover) transition-all duration-150 hover:gap-2"
              >
                <Cog6ToothIcon className="w-3.5 h-3.5" />
                管理画面
              </a>
            </div>
          )}

          {/* メインヘッダー */}
          <div
            className={cn(
              "h-12 md:h-14 flex items-center justify-between",
              isAdmin && "border-b border-(--color-border)/60",
            )}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 -ml-2 hover:bg-(--color-surface-hover) rounded-xl transition-all duration-150 hover:scale-105"
                aria-label="メニュー"
              >
                <Bars3Icon
                  className="w-5 h-5 text-(--color-text-muted)"
                  aria-hidden="true"
                />
              </button>
              <h1 className="text-base font-semibold text-(--color-text) tracking-tight">
                ねっぷちゃん
              </h1>
            </div>
            <button
              type="button"
              onClick={handleNewThread}
              disabled={createThreadMutation.isPending}
              className={cn(
                "text-sm font-medium transition-all duration-150 disabled:opacity-60 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-(--color-surface-hover)",
                isAdmin
                  ? "text-(--color-admin) hover:text-(--color-admin-hover)"
                  : "text-(--color-accent) hover:text-(--color-accent-hover)",
              )}
            >
              <PlusIcon className="w-4 h-4" />
              新しい会話
            </button>
          </div>
        </header>

        {currentThreadId && !messagesLoading ? (
          <AssistantProvider
            key={currentThreadId}
            threadId={currentThreadId}
            initialMessages={initialMessages}
            greetingPrompt={greetingPrompt}
          >
            <FeedbackProvider threadId={currentThreadId}>
              <Thread />
              <FeedbackModalWrapper />
            </FeedbackProvider>
          </AssistantProvider>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-(--color-bg)">
            {currentThreadId || messagesLoading ? (
              <div className="flex flex-col items-center gap-4">
                <LoadingDots />
                <span className="text-sm text-(--color-text-muted) font-medium">
                  読み込み中
                </span>
              </div>
            ) : (
              <span className="text-(--color-text-muted) font-medium">
                スレッドを選択してください
              </span>
            )}
          </div>
        )}
      </main>

      {/* 削除確認モーダル */}
      {threadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-stone-900/25 backdrop-blur-[3px] cursor-default"
            onClick={() => setThreadToDelete(null)}
            aria-label="キャンセル"
          />
          <div className="relative bg-white rounded-2xl p-6 w-80 shadow-xl">
            <h2 className="text-base font-semibold text-(--color-text) mb-2">
              スレッドを削除
            </h2>
            <p className="text-sm text-(--color-text-secondary) mb-6">
              このスレッドを削除しますか？会話履歴は復元できません。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setThreadToDelete(null)}
                disabled={deleteThreadMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-(--color-text-secondary) hover:bg-(--color-surface-hover) rounded-lg transition-colors disabled:opacity-60"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDeleteThread}
                disabled={deleteThreadMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60"
              >
                {deleteThreadMutation.isPending ? "削除中..." : "削除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
