import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAdminUser } from "~/hooks/useAdminUser";
import { useAnonymousSession } from "~/hooks/useAnonymousSession";
import {
  threadKeys,
  useCreateThread,
  useDeleteThread,
  useThreads,
} from "~/hooks/useThreads";
import { threadRepository } from "~/lib/api/repository";
import { getResourceId } from "~/lib/resource";
import type { InitialMessage } from "./AssistantProvider";

const storageKey = (resourceId: string) => `chat_threadId_${resourceId}`;

export const useThreadManager = () => {
  const resourceId = useMemo(() => getResourceId() ?? "default", []);
  const { data: adminUser, isLoading: isAdminLoading } = useAdminUser();
  const isAdmin = !!adminUser;
  const { isReady: isSessionReady, isFirstVisit } = useAnonymousSession();

  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [initialMessage, setInitialMessage] = useState<InitialMessage>();
  const hasInitialized = useRef(false);

  const { data: threadsData, isSuccess: threadsLoaded } = useThreads();
  const threads = useMemo(() => threadsData?.threads ?? [], [threadsData]);

  const createThreadMutation = useCreateThread();
  const deleteThreadMutation = useDeleteThread();

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: threadKeys.messages(currentThreadId ?? ""),
    queryFn: () => threadRepository.fetchMessages(currentThreadId ?? ""),
    enabled: !!currentThreadId,
  });
  const initialMessages = messagesData?.messages as UIMessage[] | undefined;

  const startThread = useCallback(
    async (initial: InitialMessage) => {
      if (createThreadMutation.isPending) return;
      const thread = await createThreadMutation.mutateAsync(undefined);
      setInitialMessage(initial);
      setCurrentThreadId(thread.id);
    },
    [createThreadMutation],
  );

  const handleNewThread = useCallback(
    () => startThread({ type: "greeting" }),
    [startThread],
  );

  const handleStartFromLanding = useCallback(
    (text: string) => startThread({ type: "user", text }),
    [startThread],
  );

  const handleSelectThread = useCallback(
    (selectedThreadId: string) => {
      if (selectedThreadId === currentThreadId) return;
      setCurrentThreadId(selectedThreadId);
      setInitialMessage(undefined);
    },
    [currentThreadId],
  );

  const deleteThread = useCallback(
    async (threadId: string) => {
      if (deleteThreadMutation.isPending) return;
      await deleteThreadMutation.mutateAsync(threadId);
      if (threadId === currentThreadId) {
        const remaining = threads.filter((t) => t.id !== threadId);
        setCurrentThreadId(remaining.length > 0 ? remaining[0].id : null);
        setInitialMessage(undefined);
      }
    },
    [currentThreadId, threads, deleteThreadMutation],
  );

  useEffect(() => {
    if (currentThreadId) {
      localStorage.setItem(storageKey(resourceId), currentThreadId);
    }
  }, [currentThreadId, resourceId]);

  useEffect(() => {
    if (threadsLoaded && !hasInitialized.current) {
      hasInitialized.current = true;
      if (threads.length > 0) {
        const savedThreadId = localStorage.getItem(storageKey(resourceId));
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
      currentThreadId === null &&
      !isFirstVisit
    ) {
      handleNewThread();
    }
  }, [
    threadsLoaded,
    threads.length,
    currentThreadId,
    isFirstVisit,
    handleNewThread,
  ]);

  const showLanding =
    isFirstVisit &&
    threadsLoaded &&
    threads.length === 0 &&
    currentThreadId === null;

  return {
    threads,
    threadsLoaded,
    currentThreadId,
    initialMessage,
    initialMessages,
    messagesLoading,
    showLanding,
    isAdmin,
    isAdminLoading,
    isSessionReady,
    isFirstVisit,
    isCreating: createThreadMutation.isPending,
    isDeleting: deleteThreadMutation.isPending,
    handleNewThread,
    handleStartFromLanding,
    handleSelectThread,
    deleteThread,
  };
};
