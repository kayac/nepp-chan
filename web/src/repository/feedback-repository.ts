import { apiClient } from "~/lib/api/client";
import type {
  FeedbackSubmitRequest,
  FeedbackSubmitResponse,
  FeedbacksResponse,
  MessageFeedback,
} from "~/types";

export const submitFeedback = (data: FeedbackSubmitRequest) =>
  apiClient<FeedbackSubmitResponse>("/feedback", {
    method: "POST",
    body: data,
  });

type FetchFeedbacksParams = {
  limit?: number;
  cursor?: string;
  rating?: "good" | "bad" | "idea";
};

export const fetchFeedbacks = (params: FetchFeedbacksParams = {}) => {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit ?? 30));
  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  }
  if (params.rating) {
    searchParams.set("rating", params.rating);
  }
  return apiClient<FeedbacksResponse>(`/admin/feedback?${searchParams}`);
};

export const fetchFeedbackById = (id: string) =>
  apiClient<MessageFeedback>(`/admin/feedback/${id}`);

type DeleteFeedbacksResponse = {
  message: string;
  count: number;
};

export const deleteAllFeedbacks = () =>
  apiClient<DeleteFeedbacksResponse>("/admin/feedback", {
    method: "DELETE",
  });

type ResolveResponse = {
  message: string;
};

export const resolveFeedback = (id: string) =>
  apiClient<ResolveResponse>(`/admin/feedback/${id}/resolve`, {
    method: "PUT",
  });

export const unresolveFeedback = (id: string) =>
  apiClient<ResolveResponse>(`/admin/feedback/${id}/resolve`, {
    method: "DELETE",
  });
