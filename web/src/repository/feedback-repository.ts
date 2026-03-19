import { client } from "~/lib/api/client";
import type { FeedbackSubmitRequest } from "~/types";

export const submitFeedback = async (body: FeedbackSubmitRequest) => {
  const { data, error } = await client.POST("/feedback", { body });
  if (error) throw error;
  return data;
};

type FetchFeedbacksParams = {
  limit?: number;
  cursor?: string;
  rating?: "good" | "bad" | "idea";
};

export const fetchFeedbacks = async (params: FetchFeedbacksParams = {}) => {
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
};

export const fetchFeedbackById = async (id: string) => {
  const { data, error } = await client.GET("/admin/feedback/{id}", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};

export const deleteAllFeedbacks = async () => {
  const { data, error } = await client.DELETE("/admin/feedback");
  if (error) throw error;
  return data;
};

export const resolveFeedback = async (id: string) => {
  const { data, error } = await client.PUT("/admin/feedback/{id}/resolve", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};

export const unresolveFeedback = async (id: string) => {
  const { data, error } = await client.DELETE("/admin/feedback/{id}/resolve", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};
