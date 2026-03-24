import { client } from "~/lib/api/client";
import type {
  BroadcastStatus,
  CreateBroadcastRequest,
  UpdateBroadcastRequest,
} from "~/types";

type FetchBroadcastsParams = {
  limit?: number;
  cursor?: string;
  status?: BroadcastStatus;
};

export const fetchBroadcasts = async (params: FetchBroadcastsParams = {}) => {
  const { data, error } = await client.GET("/admin/broadcast", {
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

export const fetchBroadcastById = async (id: string) => {
  const { data, error } = await client.GET("/admin/broadcast/{id}", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};

export const createBroadcast = async (body: CreateBroadcastRequest) => {
  const { data, error } = await client.POST("/admin/broadcast", { body });
  if (error) throw error;
  return data;
};

export const updateBroadcast = async (
  id: string,
  body: UpdateBroadcastRequest,
) => {
  const { data, error } = await client.PUT("/admin/broadcast/{id}", {
    params: { path: { id } },
    body,
  });
  if (error) throw error;
  return data;
};

export const deleteBroadcast = async (id: string) => {
  const { data, error } = await client.DELETE("/admin/broadcast/{id}", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};

export const sendBroadcastNow = async (id: string) => {
  const { data, error } = await client.POST("/admin/broadcast/{id}/send", {
    params: { path: { id } },
  });
  if (error) throw error;
  return data;
};

const toFormData = (body: unknown) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value != null) fd.append(key, value as string | Blob);
  }
  return fd;
};

export const uploadBroadcastImage = async (file: File) => {
  const { data, error } = await client.POST("/admin/broadcast/upload-image", {
    body: { file: file as unknown as string },
    bodySerializer: toFormData,
  });
  if (error) throw error;
  return data;
};
