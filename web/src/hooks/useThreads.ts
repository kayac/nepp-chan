import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createThread,
  deleteThread,
  fetchMessages,
  fetchThread,
  fetchThreads,
} from "~/repository/thread-repository";

export const threadKeys = {
  all: ["threads"] as const,
  list: (resourceId: string) =>
    [...threadKeys.all, "list", resourceId] as const,
  detail: (threadId: string) =>
    [...threadKeys.all, "detail", threadId] as const,
  messages: (threadId: string) =>
    [...threadKeys.all, "messages", threadId] as const,
};

export const useThreads = (resourceId: string, page = 0, perPage = 20) =>
  useQuery({
    queryKey: threadKeys.list(resourceId),
    queryFn: () => fetchThreads(resourceId, page, perPage),
  });

export const useThread = (threadId: string) =>
  useQuery({
    queryKey: threadKeys.detail(threadId),
    queryFn: () => fetchThread(threadId),
    enabled: !!threadId,
  });

export const useMessages = (threadId: string) =>
  useQuery({
    queryKey: threadKeys.messages(threadId),
    queryFn: () => fetchMessages(threadId),
    enabled: !!threadId,
  });

export const useCreateThread = (resourceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) => createThread(resourceId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: threadKeys.list(resourceId) });
    },
  });
};

export const useDeleteThread = (resourceId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (threadId: string) => deleteThread(threadId),
    onSuccess: (_data, threadId) => {
      queryClient.invalidateQueries({ queryKey: threadKeys.list(resourceId) });
      queryClient.removeQueries({ queryKey: threadKeys.detail(threadId) });
      queryClient.removeQueries({ queryKey: threadKeys.messages(threadId) });
    },
  });
};
