import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { AmbientBG } from "@nepp-chan/shared/components/AmbientBG";
import { LoadingDots } from "@nepp-chan/shared/ui/Loading";
import { useState } from "react";

import { ChatStandingMascot } from "~/app/chat/components/ChatStandingMascot";
import { Landing } from "~/app/chat/components/Landing";
import { TopBar } from "~/app/chat/components/TopBar";
import { Thread } from "~/components/assistant-ui/Thread";

import { AssistantProvider } from "./AssistantProvider";
import { FeedbackModalWrapper } from "./components/FeedbackModalWrapper";
import { ThreadDeleteModal } from "./components/ThreadDeleteModal";
import { ThreadSidebar } from "./components/ThreadSidebar";
import { FeedbackProvider } from "./FeedbackContext";
import { useThreadManager } from "./useThreadManager";

export const ChatPage = () => {
  const {
    threads,
    currentThreadId,
    initialMessage,
    initialMessages,
    messagesLoading,
    showLanding,
    isAdmin,
    isAdminLoading,
    isSessionReady,
    isCreating,
    isDeleting,
    handleNewThread,
    handleStartFromLanding,
    handleSelectThread,
    deleteThread,
  } = useThreadManager();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);

  if (isAdminLoading || !isSessionReady) {
    return null;
  }

  const onSelectThread = (id: string) => {
    handleSelectThread(id);
    setIsSidebarOpen(false);
  };

  const onNewThread = () => {
    handleNewThread();
    setIsSidebarOpen(false);
  };

  const onConfirmDelete = async () => {
    if (!threadToDelete) return;
    try {
      await deleteThread(threadToDelete);
      setThreadToDelete(null);
    } catch {
      // 削除失敗時はモーダルを維持（isDeleting が解除されるので再試行可能）
    }
  };

  const renderMain = () => {
    if (showLanding) {
      return (
        <Landing onSubmit={handleStartFromLanding} disabled={isCreating} />
      );
    }
    if (currentThreadId && !messagesLoading) {
      return (
        <AssistantProvider
          key={currentThreadId}
          threadId={currentThreadId}
          initialMessages={initialMessages}
          initialMessage={initialMessage}
        >
          <FeedbackProvider threadId={currentThreadId}>
            <Thread />
            <ChatStandingMascot />
            <FeedbackModalWrapper />
          </FeedbackProvider>
        </AssistantProvider>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <LoadingDots />
        <span className="text-sm text-(--fg-3) font-medium">読み込み中</span>
      </div>
    );
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-(--bg-app)">
      <AmbientBG />

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

      <TopBar onMenuClick={() => setIsSidebarOpen(true)} />

      <main className="relative z-[2] flex-1 flex flex-col min-w-0 min-h-0">
        {renderMain()}
      </main>

      <ThreadSidebar
        isOpen={isSidebarOpen}
        threads={threads}
        currentThreadId={currentThreadId}
        isCreating={isCreating}
        onClose={() => setIsSidebarOpen(false)}
        onNewThread={onNewThread}
        onSelectThread={onSelectThread}
        onRequestDelete={setThreadToDelete}
      />

      {threadToDelete && (
        <ThreadDeleteModal
          isDeleting={isDeleting}
          onConfirm={onConfirmDelete}
          onCancel={() => setThreadToDelete(null)}
        />
      )}
    </div>
  );
};
