import type { ApiClient } from "../create-client";
import type { FeedbackSubmitRequest } from "../types";

type FetchFeedbacksParams = {
  limit?: number;
  cursor?: string;
  rating?: "good" | "bad" | "idea";
};

export const createFeedbackRepository = (client: ApiClient) => ({
  submitFeedback: async (body: FeedbackSubmitRequest) => {
    const { data, error } = await client.POST("/feedback", { body });
    if (error) throw error;
    return data;
  },

  fetchFeedbacks: async (params: FetchFeedbacksParams = {}) => {
    const { data, error } = await client.GET("/admin/feedback", {
      params: {
        query: {
          limit: params.limit ?? 30,
          cursor: params.cursor,
          rating: params.rating,
        },
      },
    });
    if (error) throw error;
    return data;
  },

  fetchFeedbackById: async (id: string) => {
    const { data, error } = await client.GET("/admin/feedback/{id}", {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  },

  deleteAllFeedbacks: async () => {
    const { data, error } = await client.DELETE("/admin/feedback");
    if (error) throw error;
    return data;
  },

  resolveFeedback: async (id: string) => {
    const { data, error } = await client.PUT("/admin/feedback/{id}/resolve", {
      params: { path: { id } },
    });
    if (error) throw error;
    return data;
  },

  unresolveFeedback: async (id: string) => {
    const { data, error } = await client.DELETE(
      "/admin/feedback/{id}/resolve",
      {
        params: { path: { id } },
      },
    );
    if (error) throw error;
    return data;
  },
});

export type FeedbackRepository = ReturnType<typeof createFeedbackRepository>;
