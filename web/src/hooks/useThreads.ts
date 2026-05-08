import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createThread,
  deleteThread,
  fetchMessages,
  fetchThread,
  fetchThreads,
} from "~/repository";

export const threadKeys = {
  all: ["threads"] as const,
  list: () => [...threadKeys.all, "list"] as const,
  detail: (threadId: string) =>
    [...threadKeys.all, "detail", threadId] as const,
  messages: (threadId: string) =>
    [...threadKeys.all, "messages", threadId] as const,
};

export const useThreads = (page = 0, perPage = 20) =>
  useQuery({
    queryKey: threadKeys.list(),
    queryFn: () => fetchThreads(page, perPage),
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

export const useCreateThread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) => createThread(title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: threadKeys.list() });
    },
  });
};

export const useDeleteThread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (threadId: string) => deleteThread(threadId),
    onSuccess: (_data, threadId) => {
      queryClient.invalidateQueries({ queryKey: threadKeys.list() });
      queryClient.removeQueries({ queryKey: threadKeys.detail(threadId) });
      queryClient.removeQueries({ queryKey: threadKeys.messages(threadId) });
    },
  });
};
