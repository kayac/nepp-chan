import { apiClient } from "~/lib/api/client";
import type {
  FeedbackSubmitRequest,
  FeedbackSubmitResponse,
  FeedbacksResponse,
  MessageFeedback,
} from "~/types";

export const submitFeedback = (
  data: FeedbackSubmitRequest,
): Promise<FeedbackSubmitResponse> =>
  apiClient<FeedbackSubmitResponse>("/feedback", {
    method: "POST",
    body: data,
  });

type FetchFeedbacksParams = {
  limit?: number;
  cursor?: string;
  rating?: "good" | "bad";
};

export const fetchFeedbacks = (
  params: FetchFeedbacksParams = {},
): Promise<FeedbacksResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit ?? 30));
  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  }
  if (params.rating) {
    searchParams.set("rating", params.rating);
  }
  return apiClient<FeedbacksResponse>(`/admin/feedback?${searchParams}`, {
    admin: true,
  });
};

export const fetchFeedbackById = (id: string): Promise<MessageFeedback> =>
  apiClient<MessageFeedback>(`/admin/feedback/${id}`, {
    admin: true,
  });

type DeleteFeedbacksResponse = {
  success: boolean;
  message: string;
  count: number;
};

export const deleteAllFeedbacks = (): Promise<DeleteFeedbacksResponse> =>
  apiClient<DeleteFeedbacksResponse>("/admin/feedback", {
    method: "DELETE",
    admin: true,
  });
