import { apiClient } from "~/lib/api/client";
import type {
  BroadcastMessage,
  BroadcastStatus,
  BroadcastsResponse,
  CreateBroadcastRequest,
  UpdateBroadcastRequest,
} from "~/types";

type FetchBroadcastsParams = {
  limit?: number;
  cursor?: string;
  status?: BroadcastStatus;
};

export const fetchBroadcasts = (params: FetchBroadcastsParams = {}) => {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", String(params.limit ?? 30));
  if (params.cursor) {
    searchParams.set("cursor", params.cursor);
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  return apiClient<BroadcastsResponse>(`/admin/broadcast?${searchParams}`);
};

export const fetchBroadcastById = (id: string) =>
  apiClient<BroadcastMessage>(`/admin/broadcast/${id}`);

export const createBroadcast = (data: CreateBroadcastRequest) =>
  apiClient<BroadcastMessage>("/admin/broadcast", {
    method: "POST",
    body: data,
  });

export const updateBroadcast = (id: string, data: UpdateBroadcastRequest) =>
  apiClient<BroadcastMessage>(`/admin/broadcast/${id}`, {
    method: "PUT",
    body: data,
  });

export const deleteBroadcast = (id: string) =>
  apiClient<{ message: string }>(`/admin/broadcast/${id}`, {
    method: "DELETE",
  });

export const sendBroadcastNow = (id: string) =>
  apiClient<{ message: string }>(`/admin/broadcast/${id}/send`, {
    method: "POST",
  });
