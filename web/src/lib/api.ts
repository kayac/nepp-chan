import type { UIMessage } from "ai";

const API_BASE = import.meta.env.VITE_API_URL || "";

export type Thread = {
  id: string;
  resourceId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown> | null;
};

type ThreadsResponse = {
  threads: Thread[];
  hasMore: boolean;
  total: number;
  page: number;
  perPage: number;
};

type MessagesResponse = {
  messages: UIMessage[];
};

export const fetchThreads = async (
  resourceId: string,
  page = 0,
  perPage = 20,
): Promise<ThreadsResponse> => {
  const params = new URLSearchParams({
    resourceId,
    page: String(page),
    perPage: String(perPage),
  });
  const res = await fetch(`${API_BASE}/threads?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch threads: ${res.status}`);
  }
  return res.json();
};

export const createThread = async (
  resourceId: string,
  title?: string,
): Promise<Thread> => {
  const res = await fetch(`${API_BASE}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resourceId, title }),
  });
  if (!res.ok) {
    throw new Error(`Failed to create thread: ${res.status}`);
  }
  return res.json();
};

export const fetchThread = async (threadId: string): Promise<Thread> => {
  const res = await fetch(`${API_BASE}/threads/${threadId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch thread: ${res.status}`);
  }
  return res.json();
};

export const fetchMessages = async (
  threadId: string,
  limit = 50,
): Promise<MessagesResponse> => {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`${API_BASE}/threads/${threadId}/messages?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch messages: ${res.status}`);
  }
  return res.json();
};
