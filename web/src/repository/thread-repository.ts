import { apiClient } from "~/lib/api/client";
import type { MessagesResponse, Thread, ThreadsResponse } from "~/types";

export const fetchThreads = (
  resourceId: string,
  page = 0,
  perPage = 20,
): Promise<ThreadsResponse> => {
  const params = new URLSearchParams({
    resourceId,
    page: String(page),
    perPage: String(perPage),
  });
  return apiClient<ThreadsResponse>(`/threads?${params}`);
};

export const createThread = (
  resourceId: string,
  title?: string,
): Promise<Thread> =>
  apiClient<Thread>("/threads", {
    method: "POST",
    body: { resourceId, title },
  });

export const deleteThread = (threadId: string): Promise<{ message: string }> =>
  apiClient<{ message: string }>(`/threads/${threadId}`, { method: "DELETE" });

export const fetchThread = (threadId: string): Promise<Thread> =>
  apiClient<Thread>(`/threads/${threadId}`);

export const fetchMessages = (threadId: string): Promise<MessagesResponse> =>
  apiClient<MessagesResponse>(`/threads/${threadId}/messages`);
