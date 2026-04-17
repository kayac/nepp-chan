import { client } from "~/lib/api/client";
import type { CreatePollRequest, PollStatus, UpdatePollRequest } from "~/types";

type FetchPollsParams = {
  limit?: number;
  cursor?: string;
  status?: PollStatus;
};

export const fetchPolls = async (params: FetchPollsParams = {}) => {
  const { data, error } = await client.GET("/admin/polls", {
    params: {
      query: {
        limit: params.limit ?? 30,
        cursor: params.cursor,
        status: params.status,
      },
    },
  });
  if (error) throw error;
  return data;
};

export const fetchPollById = async (id: string) => {
  const { data, error } = await client.GET("/admin/polls/{id}", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};

export const createPoll = async (body: CreatePollRequest) => {
  const { data, error } = await client.POST("/admin/polls", { body });
  if (error) throw error;
  return data;
};

export const updatePoll = async (id: string, body: UpdatePollRequest) => {
  const { data, error } = await client.PUT("/admin/polls/{id}", {
    params: { path: { id } },
    body,
  });
  if (error) throw error;
  return data;
};

export const deletePoll = async (id: string) => {
  const { data, error } = await client.DELETE("/admin/polls/{id}", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};

export const sendPollNow = async (id: string) => {
  const { data, error } = await client.POST("/admin/polls/{id}/send", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};

export const closePoll = async (id: string) => {
  const { data, error } = await client.POST("/admin/polls/{id}/close", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};

export const fetchPollResultsAdmin = async (id: string) => {
  const { data, error } = await client.GET("/admin/polls/{id}/results", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};

export const fetchPollResults = async (id: string) => {
  const { data, error } = await client.GET("/polls/{id}", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};
