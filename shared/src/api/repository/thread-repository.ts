import type { ApiClient } from "../create-client";

export const createThreadRepository = (client: ApiClient) => ({
  fetchThreads: async (page = 0, perPage = 20) => {
    const { data, error } = await client.GET("/threads", {
      params: { query: { page, perPage } },
    });
    if (error) throw error;
    return data;
  },

  createThread: async (title?: string) => {
    const { data, error } = await client.POST("/threads", {
      body: { title },
    });
    if (error) throw error;
    return data;
  },

  deleteThread: async (threadId: string) => {
    const { data, error } = await client.DELETE("/threads/{threadId}", {
      params: { path: { threadId } },
    });
    if (error) throw error;
    return data;
  },

  fetchThread: async (threadId: string) => {
    const { data, error } = await client.GET("/threads/{threadId}", {
      params: { path: { threadId } },
    });
    if (error) throw error;
    return data;
  },

  fetchMessages: async (threadId: string) => {
    const { data, error } = await client.GET("/threads/{threadId}/messages", {
      params: { path: { threadId } },
    });
    if (error) throw error;
    return data;
  },
});

export type ThreadRepository = ReturnType<typeof createThreadRepository>;
