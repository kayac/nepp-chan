import type { ApiClient } from "../create-client";
import type {
  CreatePollRequest,
  PollStatus,
  UpdatePollRequest,
} from "../types";

type FetchPollsParams = {
  limit?: number;
  cursor?: string;
  status?: PollStatus;
};

export const createPollRepository = (client: ApiClient) => ({
  fetchPolls: async (params: FetchPollsParams = {}) => {
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
  },

  fetchPollById: async (id: string) => {
    const { data, error } = await client.GET("/admin/polls/{id}", {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  },

  createPoll: async (body: CreatePollRequest) => {
    const { data, error } = await client.POST("/admin/polls", { body });
    if (error) throw error;
    return data;
  },

  updatePoll: async (id: string, body: UpdatePollRequest) => {
    const { data, error } = await client.PUT("/admin/polls/{id}", {
      params: { path: { id } },
      body,
    });
    if (error) throw error;
    return data;
  },

  deletePoll: async (id: string) => {
    const { data, error } = await client.DELETE("/admin/polls/{id}", {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  },

  sendPollNow: async (id: string) => {
    const { data, error } = await client.POST("/admin/polls/{id}/send", {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  },

  closePoll: async (id: string) => {
    const { data, error } = await client.POST("/admin/polls/{id}/close", {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  },

  fetchPollResultsAdmin: async (id: string) => {
    const { data, error } = await client.GET("/admin/polls/{id}/results", {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  },

  fetchPollResults: async (id: string) => {
    const { data, error } = await client.GET("/polls/{id}", {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  },
});

export type PollRepository = ReturnType<typeof createPollRepository>;
