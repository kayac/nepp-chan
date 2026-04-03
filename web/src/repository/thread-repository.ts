import { client } from "~/lib/api/client";

export const fetchThreads = async (page = 0, perPage = 20) => {
  const { data, error } = await client.GET("/threads", {
    params: { query: { page, perPage } },
  });
  if (error) throw error;
  return data;
};

export const createThread = async (title?: string) => {
  const { data, error } = await client.POST("/threads", {
    body: { title },
  });
  if (error) throw error;
  return data;
};

export const deleteThread = async (threadId: string) => {
  const { data, error } = await client.DELETE("/threads/{threadId}", {
    params: { path: { threadId } },
  });
  if (error) throw error;
  return data;
};

export const fetchThread = async (threadId: string) => {
  const { data, error } = await client.GET("/threads/{threadId}", {
    params: { path: { threadId } },
  });
  if (error) throw error;
  return data;
};

export const fetchMessages = async (threadId: string) => {
  const { data, error } = await client.GET("/threads/{threadId}/messages", {
    params: { path: { threadId } },
  });
  if (error) throw error;
  return data;
};
