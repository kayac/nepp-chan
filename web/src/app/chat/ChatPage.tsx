import {
  Cog6ToothIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Thread } from "~/components/assistant-ui/Thread";
import { AmbientBG } from "~/components/companion/AmbientBG";
import { ChatStandingMascot } from "~/components/companion/ChatStandingMascot";
import { Constellation } from "~/components/companion/Constellation";
import { TopBar } from "~/components/companion/TopBar";
import { LoadingDots } from "~/components/ui/Loading";
import { useAdminUser } from "~/hooks/useAdminUser";
import { useAnonymousSession } from "~/hooks/useAnonymousSession";
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
  const resourceId = useMemo(() => getResourceId() ?? "default", []);
  const { data: adminUser, isLoading: isAdminLoading } = useAdminUser();
  const isAdmin = !!adminUser;
  const { isReady: isSessionReady } = useAnonymousSession();

  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [greetingPrompt, setGreetingPrompt] = useState<string>();
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  const isFirstVisit = useRef(false);

  const { data: threadsData, isSuccess: threadsLoaded } = useThreads();
  const threads = threadsData?.threads ?? [];

  const createThreadMutation = useCreateThread();
  const deleteThreadMutation = useDeleteThread();

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: threadKeys.messages(currentThreadId ?? ""),
    queryFn: () => fetchMessages(currentThreadId ?? ""),
    enabled: !!currentThreadId,
  });
  const initialMessages = messagesData?.messages as UIMessage[] | undefined;

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

  if (isAdminLoading || !isSessionReady) {
    return null;
  }

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-(--bg-app)">
      {/* 背景レイヤー */}
      <AmbientBG />
      <Constellation />

      {/* 管理者モードバナー */}
      {isAdmin && (
        <div className="relative z-[4] h-9 px-7 bg-(--admin-bg) border-b border-(--admin-border)/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-(--admin) animate-pulse" />
            <span className="text-xs font-semibold text-(--admin) tracking-wide">
              管理者モード
            </span>
          </div>
          <a
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-medium text-(--admin) hover:text-(--admin-hover) transition-all duration-150 hover:gap-2"
          >
            <Cog6ToothIcon className="size-3.5" />
            管理画面
          </a>
        </div>
      )}

      {/* TopBar */}
      <TopBar onMenuClick={() => setIsSidebarOpen(true)} />

      {/* メインコンテンツ */}
      <main className="relative z-[2] flex-1 flex flex-col min-w-0 min-h-0">
        {currentThreadId && !messagesLoading ? (
          <AssistantProvider
            key={currentThreadId}
            threadId={currentThreadId}
            initialMessages={initialMessages}
            greetingPrompt={greetingPrompt}
          >
            <FeedbackProvider threadId={currentThreadId}>
              <Thread />
              <ChatStandingMascot />
              <FeedbackModalWrapper />
            </FeedbackProvider>
          </AssistantProvider>
        ) : messagesLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <LoadingDots />
            <span className="text-sm text-(--fg-3) font-medium">
              読み込み中
            </span>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-(--fg-3) font-medium">
              スレッドを選択してください
            </span>
          </div>
        )}
      </main>

      {/* サイドバーオーバーレイ */}
      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[40] bg-stone-900/30 backdrop-blur-[3px] cursor-default animate-fade-in"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="サイドバーを閉じる"
        />
      )}

      {/* サイドバー（スライドインパネル） */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-[50] h-full w-[300px] max-w-[85vw]",
          "bg-(--paper-0) border-l border-(--paper-200) flex flex-col",
          "transition-transform duration-300 ease-out will-change-transform",
          isSidebarOpen ? "translate-x-0" : "translate-x-full",
        )}
        style={{ boxShadow: "var(--shadow-float-lg)" }}
      >
        <div className="flex flex-col gap-3 p-4 border-b border-(--paper-200)">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-(--fg-1) font-(family-name:--font-display)">
              スレッド
            </span>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 hover:bg-(--paper-100) rounded-md transition-colors"
              aria-label="閉じる"
            >
              <XMarkIcon className="size-5 text-(--fg-3)" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleNewThread}
            disabled={createThreadMutation.isPending}
            className={cn(
              "w-full rounded-lg text-sm font-medium transition-colors",
              "bg-(--brand) text-(--paper-0)",
              "hover:bg-(--brand-hover)",
              "disabled:opacity-60 disabled:cursor-not-allowed",
              "flex items-center justify-center gap-2",
              "px-4 py-2.5",
            )}
          >
            {createThreadMutation.isPending ? (
              <LoadingDots size="sm" />
            ) : (
              <>
                <PlusIcon className="size-4" />
                新しい会話
              </>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
          {threads.map((thread: ThreadType) => {
            const isSelected = thread.id === currentThreadId;
            return (
              <div
                key={thread.id}
                className={cn(
                  "group relative rounded-lg transition-colors",
                  isSelected ? "bg-(--paper-100)" : "hover:bg-(--paper-100)",
                )}
              >
                <button
                  type="button"
                  onClick={() => handleSelectThread(thread.id)}
                  className="w-full min-w-0 text-left flex flex-col gap-1 px-4 py-2.5"
                >
                  <div
                    className={cn(
                      "text-sm font-medium truncate",
                      isSelected ? "text-(--fg-1)" : "text-(--fg-2)",
                    )}
                  >
                    {thread.title ?? "新しい会話"}
                  </div>
                  <div className="text-xs text-(--fg-4)">
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
                    "absolute top-2 right-2 p-1.5 rounded-md transition-all duration-150",
                    "hover:bg-red-100 hover:text-red-600",
                    "text-(--fg-3)",
                    isSelected
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                  )}
                  aria-label="スレッドを削除"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* 削除確認モーダル */}
      {threadToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-stone-900/30 backdrop-blur-[3px] cursor-default"
            onClick={() => setThreadToDelete(null)}
            aria-label="キャンセル"
          />
          <div
            className="relative bg-(--paper-0) rounded-2xl p-6 w-80 border border-(--paper-200)"
            style={{ boxShadow: "var(--shadow-float-lg)" }}
          >
            <h2 className="text-base font-semibold text-(--fg-1) mb-2 font-(family-name:--font-display)">
              スレッドを削除
            </h2>
            <p className="text-sm text-(--fg-2) mb-6">
              このスレッドを削除しますか？会話履歴は復元できません。
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setThreadToDelete(null)}
                disabled={deleteThreadMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-(--fg-2) hover:bg-(--paper-100) rounded-lg transition-colors disabled:opacity-60"
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
