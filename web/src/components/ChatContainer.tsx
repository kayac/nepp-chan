import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createThread, fetchThreads, type Thread } from "~/lib/api";
import { getResourceId } from "~/lib/resource";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";

export const ChatContainer = () => {
  const resourceId = useMemo(() => getResourceId(), []);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const isCreatingThread = useRef(false);

  const handleNewThread = useCallback(async () => {
    if (isCreatingThread.current) return;
    isCreatingThread.current = true;
    try {
      const thread = await createThread(resourceId);
      setThreads((prev) => [thread, ...prev]);
      setCurrentThreadId(thread.id);
      setIsSidebarOpen(false);
    } finally {
      isCreatingThread.current = false;
    }
  }, [resourceId]);

  const handleSelectThread = useCallback((threadId: string) => {
    setCurrentThreadId(threadId);
    setIsSidebarOpen(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const result = await fetchThreads(resourceId);
      setThreads(result.threads);
      if (result.threads.length > 0) {
        setCurrentThreadId(result.threads[0].id);
      }
      setIsInitialized(true);
    };
    init();
  }, [resourceId]);

  useEffect(() => {
    if (isInitialized && threads.length === 0 && currentThreadId === null) {
      handleNewThread();
    }
  }, [isInitialized, threads.length, currentThreadId, handleNewThread]);

  const threadId = currentThreadId ?? "";

  const { messages, status, error, sendMessage } = useChat({
    id: threadId,
    transport: useMemo(
      () =>
        new DefaultChatTransport({
          api: "/chat",
          prepareSendMessagesRequest({ messages }) {
            return {
              body: {
                messages: messages.map((m) => ({
                  role: m.role,
                  content:
                    m.parts
                      ?.filter(
                        (p): p is { type: "text"; text: string } =>
                          p.type === "text",
                      )
                      .map((p) => p.text)
                      .join("") ?? "",
                })),
                resourceId,
                threadId,
              },
            };
          },
        }),
      [resourceId, threadId],
    ),
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSend = (content: string) => {
    if (!threadId) return;
    sendMessage({ text: content });
  };

  return (
    <div className="flex h-screen bg-white">
      {isSidebarOpen && (
        <div className="w-64 border-r bg-gray-50 flex flex-col">
          <div className="p-3 border-b">
            <button
              type="button"
              onClick={handleNewThread}
              className="w-full px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium"
            >
              + 新しい会話
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => handleSelectThread(thread.id)}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                  thread.id === currentThreadId ? "bg-gray-200" : ""
                }`}
              >
                <div className="truncate font-medium text-gray-800">
                  {thread.title ?? "新しい会話"}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(thread.updatedAt).toLocaleDateString("ja-JP")}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col">
        <header className="border-b bg-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1 hover:bg-gray-100 rounded"
              aria-label="メニューを開く"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <span className="text-2xl">🦊</span>
            <h1 className="text-lg font-bold text-gray-800">ねっぷちゃん</h1>
          </div>
          <button
            type="button"
            onClick={handleNewThread}
            className="text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            新しい会話
          </button>
        </header>

        <MessageList messages={messages} isLoading={isLoading} />

        {error && (
          <div className="mx-4 mb-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            エラー: {error.message}
          </div>
        )}

        <ChatInput onSend={handleSend} disabled={isLoading || !threadId} />
      </div>
    </div>
  );
};
