import { API_BASE, client } from "~/lib/api/client";
import { getAuthToken } from "~/lib/auth-token";
import type { ConvertFileResponse, UploadFileResponse } from "~/types";

export const syncKnowledge = async () => {
  const { data, error } = await client.POST("/admin/knowledge/sync");
  if (error) throw error;
  return data;
};

export const deleteAllKnowledge = async () => {
  const { data, error } = await client.DELETE("/admin/knowledge");
  if (error) throw error;
  return data;
};

export const fetchFiles = async () => {
  const { data, error } = await client.GET("/admin/knowledge/files");
  if (error) throw error;
  return data;
};

export const fetchFileContent = async (key: string) => {
  const { data, error } = await client.GET("/admin/knowledge/files/{key}", {
    params: { path: { key } },
  });
  if (error) throw error;
  return data;
};

export const saveFile = async (key: string, content: string) => {
  const { data, error } = await client.PUT("/admin/knowledge/files/{key}", {
    params: { path: { key } },
    body: { content },
  });
  if (error) throw error;
  return data;
};

export const deleteFile = async (key: string) => {
  const { data, error } = await client.DELETE("/admin/knowledge/files/{key}", {
    params: { path: { key } },
  });
  if (error) throw error;
  return data;
};

// multipart/form-data — raw fetch を維持
export const uploadFile = async (file: File, filename?: string) => {
  const formData = new FormData();
  formData.append("file", file);
  if (filename) {
    formData.append("filename", filename);
  }

  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/admin/knowledge/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || "アップロードに失敗しました");
  }

  return res.json() as Promise<UploadFileResponse>;
};

// multipart/form-data — raw fetch を維持
export const convertFile = async (file: File, filename: string) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", filename);

  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/admin/knowledge/convert`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error?.message || "変換に失敗しました");
  }

  return res.json() as Promise<ConvertFileResponse>;
};

export const fetchUnifiedFiles = async () => {
  const { data, error } = await client.GET("/admin/knowledge/unified");
  if (error) throw error;
  return data;
};

export const getOriginalFileUrl = (key: string) => {
  const encodedKey = encodeURIComponent(key.replace("originals/", ""));
  return `${API_BASE}/admin/knowledge/originals/${encodedKey}`;
};

export const reconvertFile = async (originalKey: string, filename: string) => {
  const { data, error } = await client.POST("/admin/knowledge/reconvert", {
    body: { originalKey, filename },
  });
  if (error) throw error;
  return data;
};
